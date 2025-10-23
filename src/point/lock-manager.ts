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
    const previousLock = this.getPreviousLock(userId);

    // 새로운 Lock 생성 및 등록
    const { lock: currentLock, release } = this.createLock();
    this.locks.set(userId, currentLock);

    try {
      // 이전 작업이 완료될 때까지 대기
      await previousLock;

      // 실제 작업 수행 및 결과 반환
      return await operation();
    } finally {
      // Lock 해제 및 정리
      release();
      this.cleanupLockIfNeeded(userId, currentLock);
    }
  }

  /**
   * 이전 Lock을 조회합니다
   */
  private getPreviousLock(userId: number): Promise<void> {
    return this.locks.get(userId) || Promise.resolve();
  }

  /**
   * 새로운 Lock을 생성합니다
   */
  private createLock(): { lock: Promise<void>; release: () => void } {
    let release: () => void;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { lock, release: release! };
  }

  /**
   * 더 이상 대기 중인 작업이 없으면 Lock을 제거합니다
   */
  private cleanupLockIfNeeded(
    userId: number,
    currentLock: Promise<void>,
  ): void {
    if (this.locks.get(userId) === currentLock) {
      this.locks.delete(userId);
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
