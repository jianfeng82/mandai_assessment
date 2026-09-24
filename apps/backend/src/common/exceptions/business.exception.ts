import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  public readonly result: unknown;

  constructor(
    public readonly internalCode: string,
    message: string,
    httpStatus: HttpStatus = HttpStatus.BAD_REQUEST,
    result: unknown = {},
  ) {
    super(
      {
        statusCode: httpStatus,
        errorcode: internalCode,
        message,
        result,
      },
      httpStatus,
    );
    this.result = result;
  }
}
