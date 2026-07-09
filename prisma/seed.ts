import { differenceInMinutes } from "date-fns";
import {
  IncidentEventType,
  IncidentStatus,
  PrismaClient,
  Role,
  Severity,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany({
    where: {
      email: { in: ["admin@empresa.com", "user@empresa.com"] },
    },
  });

  const adminEmail = "admin@dafiti.com";
  const adminPassword = "Admin@123";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Admin",
      role: Role.ADMIN,
      isActive: true,
      passwordHash: adminPasswordHash,
    },
    create: {
      email: adminEmail,
      name: "Admin",
      role: Role.ADMIN,
      passwordHash: adminPasswordHash,
    },
  });

  await prisma.user.upsert({
    where: { email: "user@dafiti.com" },
    update: {
      name: "User",
      role: Role.USER,
      isActive: true,
    },
    create: {
      email: "user@dafiti.com",
      name: "User",
      role: Role.USER,
    },
  });

  const applications = [
    { name: "Checkout", slug: "checkout", owner: "Checkout Squad" },
    { name: "Catalog", slug: "catalog", owner: "Catalog Squad" },
    { name: "Payments", slug: "payments", owner: "Payments Squad" },
    { name: "Search", slug: "search", owner: "Search Squad" },
  ];

  for (const app of applications) {
    await prisma.application.upsert({
      where: { slug: app.slug },
      update: app,
      create: app,
    });
  }

  const appRecords = await prisma.application.findMany({
    where: {
      slug: {
        in: applications.map((app) => app.slug),
      },
    },
  });

  const applicationBySlug = new Map(
    appRecords.map((record) => [record.slug, record]),
  );

  const startedAt = new Date("2025-03-12T17:05:00.000Z");
  const resolvedAt = new Date("2025-03-12T17:48:00.000Z");

  const durationMin = Math.max(
    0,
    differenceInMinutes(resolvedAt, startedAt),
  );
  const durationHoursReported = Math.floor(durationMin / 60);
  const durationMinutesReported = durationMin % 60;

  const incident = await prisma.incident.upsert({
    where: { id: "seed-incident-checkout-001" },
    update: {},
    create: {
      id: "seed-incident-checkout-001",
      sanv2Code: "SANV2-SEED-001",
      title: "Erro 5xx no Checkout",
      description: "Aumento de 5xx em /orders",
      status: IncidentStatus.RECUPERADO,
      severity: Severity.P1,
      impact: "30% das transações falharam",
      owner: "Checkout Squad",
      scope: "Brasil",
      country: "BR",
      dayNumber: 12,
      monthNumber: 3,
      yearNumber: 2025,
      solutionType: "Paliativa",
      cause: "Falha em deploy de release crítica com rollback parcial.",
      resolution: "Rollback completo aplicado e limpezas de cache executadas.",
      produtosOkr: "Checkout",
      coreSystems: "Checkout API",
      solver: "SRE Checkout",
      ordersAffected: "1200 pedidos",
      financialImpact: "R$ 50.000",
      reporterId: admin.id,
      jiraIssueKey: "SRE-1000",
      links: {
        grafana: "https://grafana.example.com/d/checkout",
        runbook: "https://runbooks.example.com/checkout/p1-5xx",
      },
      startedAt,
      resolvedAt,
      durationMinutes: durationMin,
      downtimeMinutes: durationMin,
      durationHoursReported,
      durationMinutesReported,
      totalMinutesReported: durationMin,
      timeline: {
        create: [
          {
            type: IncidentEventType.OPENED,
            message: "Alertas de 5xx acima do limiar.",
            authorId: admin.id,
            createdAt: startedAt,
          },
          {
            type: IncidentEventType.RESOLVED,
            message: "Incidente mitigado após rollback do serviço de pagamento.",
            authorId: admin.id,
            createdAt: resolvedAt,
          },
        ],
      },
      rca: "Investigação em andamento – RCA será publicado em 48h.",
      applications: {
        create: [
          {
            applicationId: applicationBySlug.get("checkout")!.id,
          },
        ],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_INCIDENT",
      entity: `INCIDENT:${incident.id}`,
      after: {
        severity: incident.severity,
        status: incident.status,
      },
    },
  });

  for (const app of applications) {
    const application = applicationBySlug.get(app.slug);
    if (!application) {
      continue;
    }
    await prisma.sLAConfig.upsert({
      where: { applicationId: application.id },
      update: {},
      create: {
        applicationId: application.id,
        uptimeTarget: 99.9,
        mttaTargetMin: 15,
        mttrTargetMin: 60,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
