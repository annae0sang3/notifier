export interface Env {
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // API 엔드포인트: /api/duty-list
    if (url.pathname === '/api/duty-list') {
      // 간단한 교대근무자 목록 반환 (예시)
      const dummyData = [
        { name: '김철수', day: '월요일' },
        { name: '박영희', day: '화요일' },
        { name: '이지수', day: '수요일' },
      ];
      return new Response(JSON.stringify(dummyData), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
