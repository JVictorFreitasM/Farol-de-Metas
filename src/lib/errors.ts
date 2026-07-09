export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (msg: string) => new ApiError(400, msg);
export const forbidden = (msg: string) => new ApiError(403, msg);
export const notFound = (msg: string) => new ApiError(404, msg);
export const conflict = (msg: string) => new ApiError(409, msg);
export const unauthorized = (msg: string) => new ApiError(401, msg);
