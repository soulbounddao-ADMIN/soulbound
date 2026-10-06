export async function readJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

export function submitErrorMessage(status: number): string {
  switch (status) {
    case 422:
      return "입력 내용을 확인해 주세요.";
    case 403:
      return "이 신청을 제출할 권한이 없습니다.";
    case 409:
      return "이미 진행 중인 신청이 있거나 상태가 변경되었습니다.";
    case 502:
      return "서비스 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}
