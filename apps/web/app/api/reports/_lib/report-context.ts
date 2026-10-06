import type { SupabaseAdapterClient } from "@soulbound/adapters";
import { ReportService } from "./report-service";
import { SupabaseReportRepository } from "./supabase-report-repository";

export function makeReportService(client: SupabaseAdapterClient): ReportService {
  return new ReportService(new SupabaseReportRepository(client));
}
