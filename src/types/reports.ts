import { Environment, RequestType } from "@prisma/client";

export interface SystemReportData {
  summary: {
    vms: number;
    requests: number;
    licenses: number;
  };
  envDistribution: {
    environment: Environment;
    _count: { _all: number };
  }[];
  typeDistribution: {
    requestType: RequestType;
    _count: { _all: number };
  }[];
  trends: {
    day: string;
    count: number;
  }[];
  topRequesters: {
    requesterId: string;
    _count: { _all: number };
    user: {
      name: string | null;
      email: string | null;
    } | null;
  }[];
  timestamp: string;
}