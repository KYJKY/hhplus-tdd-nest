import { Injectable } from '@nestjs/common';

/**
 * 사용자별 Lock을 관리하는 클래스
 * In-memory 기반으로 동일 사용자의 동시 요청을 순차적으로 처리합니다.
 */
@Injectable()
export class LockManager {
  // 사용자별 Lock을 저장하는 Map (userId -> Promise)
  private locks = new Map<number, Promise<void>>();

  /**
   * Lock을 획득하고 작업을 실행합니다.
   * 동일 사용자의 이전 작업이 완료될 때까지 대기한 후 실행됩니다.
   *
   * @param userId - 사용자 ID
   * @param operation - 실행할 작업 (async 함수)
   * @returns 작업의 결과
   */
  async acquire<T>(userId: number, operation: () => Promise<T>): Promise<T> {
    // 해당 사용자의 이전 Lock을 가져옴 (없으면 즉시 resolve되는 Promise)
    const previousLock = this.locks.get(userId) || Promise.resolve();

    // 새로운 Lock을 위한 Promise 생성
    let releaseLock: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // 새로운 Lock을 Map에 저장 (다음 요청은 이 Lock이 해제될 때까지 대기)
    this.locks.set(userId, currentLock);

    try {
      // 이전 작업이 완료될 때까지 대기
      await previousLock;

      // 실제 작업 수행
      const result = await operation();

      return result;
    } finally {
      // Lock 해제 (다음 작업이 진행될 수 있도록)
      releaseLock!();

      // 더 이상 대기 중인 작업이 없으면 Map에서 제거 (메모리 최적화)
      if (this.locks.get(userId) === currentLock) {
        this.locks.delete(userId);
      }
    }
  }

  /**
   * 특정 사용자의 Lock이 활성화되어 있는지 확인
   * (테스트 및 디버깅용)
   */
  hasActiveLock(userId: number): boolean {
    return this.locks.has(userId);
  }

  /**
   * 모든 Lock을 초기화
   * (테스트용)
   */
  clear(): void {
    this.locks.clear();
  }
}
