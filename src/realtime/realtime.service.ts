import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type RealtimeEvent =
  | {
      type: 'chat.message';
      eventId: string;
      matchId: string;
      payload: unknown;
    }
  | {
      type: 'battle.state';
      eventId: string;
      matchId: string;
      payload: unknown;
    };

@Injectable()
export class RealtimeService {
  private readonly eventsSubject = new Subject<RealtimeEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  publish(event: RealtimeEvent): void {
    this.eventsSubject.next(event);
  }
}
