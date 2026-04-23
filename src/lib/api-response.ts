import { ApiResponse, PaginatedResponse } from "@/types";

export function success<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

export function error(message: string, code?: string): ApiResponse {
  return {
    success: false,
    error: message,
    code,
  };
}

export function paginated<T>(
  data: T,
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
