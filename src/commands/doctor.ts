import { runDoctorChecks } from "../lib/doctor-checks";

function output(obj: unknown): void {
  console.log(JSON.stringify(obj, null, 2));
}

export async function cmdDoctor(): Promise<void> {
  const result = await runDoctorChecks();
  output(result);
  process.exit(result.ok ? 0 : 1);
}
