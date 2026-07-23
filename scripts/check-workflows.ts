import prisma from "../src/lib/prisma";

async function checkWorkflows() {
  const workflows = await prisma.approvalWorkflow.findMany({
    orderBy: [{ requestType: 'asc' }, { level: 'asc' }]
  });
  
  console.log('Total workflows:', workflows.length);
  workflows.forEach((w: any) => {
    console.log(`${w.requestType} | Level ${w.level} | ${w.role} | isFinal: ${w.isFinal}`);
  });
  
  await prisma.$disconnect();
}

checkWorkflows().catch(console.error);