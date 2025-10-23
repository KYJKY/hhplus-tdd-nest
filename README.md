# [ 1주차 ] AI 기반 개발 환경 구축

## 목표
- Test Code, Testable Code, TDD에 대한 학습하기
- Claude Code에 대해 이해하고 개발 환경 세팅하기
- 학습한 테스트 관련 내용들을 바탕으로 AI와 함께 개발하기

## 개발 방법론 적용
Red-Green-Refactor 사이클 적용하여 개발 진행
- 해당 사이클을 적용하기 위해 `.claude/commands/*` 내 커스텀 커맨드 작성
- 테스트 작성 -> 테스트가 통과하도록 구현 -> 구현 리펙토링 사이클 반복
- 여러가지 커스텀 커맨드를 작성하였으나, 실제로는 테스트 리뷰, Refactor 과정에 대한 커스텀 커맨드를 주로 사용함

## 구현 추가 정책
- 최대 보유 가능 포인트는 1천만 포인트이다.
- 1건당 최대 충전 금액은 100만 포인트이다.
- 포인트 사용단위는 100 포인트 단위로 사용 가능하다.

## 동시성 제어 방식 분석
### 기존 코드의 문제점 (동시성 제어 처리 X)
동일 사용자의 동시 요청 시 Race Condition이 발생할 수 있다.

**ex) 한 유저가 포인트 충전을 한 번에 두 번 동시에 진행한 경우**
요청1: Read(잔액:1000) > 계산(+500) > Write(1500)
요청2: Read(잔액:1000) > 계산(+500) > Write(1500)

예상 결과: 2000원
실제 결과: 1500원 (500원 손실)

이러한 문제를 해결하기 위해 동시성 제어가 필수적이며, 다음 요구사항을 만족해야 한다.
- 동일 사용자의 요청은 순차적으로 처리
- 서로 다른 사용자의 요청은 병렬로 처리
- 데드락 방지
- 성능 저하 최소화

현재 프로젝트에서 적용 가능한 동시성 제어 방식을 조사하였고, 그 중 Mutex/Lock 방식을 구현하기로 하였다.

### Mutex/Lock 구현

Promise Chain을 활용한 사용자별 Lock 메커니즘
```Typescript
  @Injectable()
  export class LockManager {
    // 사용자별 Lock을 저장 (userId → Promise)
    private locks = new Map<number, Promise<void>>();

    async acquire<T>(userId: number, operation: () => Promise<T>): Promise<T> {
      // 1. 이전 Lock 가져오기 (없으면 즉시 실행)
      const previousLock = this.locks.get(userId) || Promise.resolve();

      // 2. 새 Lock 생성 및 등록
      const { lock: currentLock, release } = this.createLock();
      this.locks.set(userId, currentLock);

      try {
        // 3. 이전 작업 완료 대기
        await previousLock;
        // 4. 실제 작업 실행
        return await operation();
      } finally {
        // 5. Lock 해제 및 정리
        release();
        this.cleanupLockIfNeeded(userId, currentLock);
      }
    }
  }
```

**동작 원리**
`LockManager`는 JavaScript의 `Promise`를 체인처럼 연결하여 동일 사용자의 요청을 순차적으로 처리한다.
각 요청은 이전 요청이 완료될 때까지 기다리는 `Promise`를 받고, 그 요청 자신도 다음 요청이 기다려야 할 `Promise`를 Map에 등록하는 방식으로 동작한다.

**단일 요청이 들어왔을 때**
1. Lock 확인
  - 사용자의 이전 Lock이 없으면 `Promise.resolve()` (즉시 통과).
2. 새 Lock 생성 및 등록
  - `createLock()`으로 새 `Promise`와 `release` 함수를 만들고 Map에 등록.
3. 작업 실행
  - 이전 Lock을 기다린 뒤(`await previousLock`), 실제 `operation()` 수행.
4. 해제 및 정리
  - 완료 후 `release()` 호출하여 Lock 완료.
  - `cleanupLockIfNeeded`로 현재 Lock이 마지막이면 Map에서 제거.

**동시 요청이 들어왔을 때**
1. 요청1: Lock 없음 > Lock1 생성 및 등록 > 즉시 실행.
2. 요청2: 이전 Lock(Lock1) 참조 > Lock2 생성 및 등록 > Lock1 완료까지 대기.
3. 요청3: 이전 Lock(Lock2) 참조 > Lock3 생성 및 등록 > Lock2 완료까지 대기.
4. 순차 실행
  - Lock1 완료 > 요청2 실행 시작
  - Lock2 완료 > 요청3 실행 시작
  - Lock3 완료 > Map 정리 > 동일 사용자 요청은 순서대로(FIFO) 실행 보장.

**순차 처리가 보장되는 이유**
- 단일 스레드 특성: JavaScript는 단일 스레드로 동작하므로, locks.set()은 항상 순서대로 실행
- 이전 Lock 참조 유지: 각 요청은 이전 Lock을 별도로 참조(previousLock)하므로, Map이 갱신되어도 체인이 끊기지 않음
- Promise await 동작: await은 해당 Promise가 resolve될 때까지 실행을 멈추므로, 앞선 요청이 끝나야 다음 요청이 진행 > 결과적으로 요청 순서(FIFO) 가 보장


