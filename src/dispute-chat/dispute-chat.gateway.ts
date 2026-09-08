import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { DisputeChatService } from './dispute-chat.service';
import { RealtimeEvent, RealtimeService } from '../realtime/realtime.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';

interface SocketData {
  user: AuthenticatedUser;
}

type AuthenticatedSocket = Omit<Socket, 'data'> & {
  data: SocketData;
};

const matchRoom = (matchId: string) => `match:${matchId}`;

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class DisputeChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly subscriptions = new Map<
    string,
    { unsubscribe: () => void }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly disputeChatService: DisputeChatService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(): void {
    const subscription = this.realtimeService.events$.subscribe((event) => {
      this.broadcast(event);
    });
    this.subscriptions.set('events', subscription);
  }

  handleConnection(socket: AuthenticatedSocket): void {
    try {
      const token = this.extractToken(socket);
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
        role: AuthenticatedUser['role'];
      }>(token);
      socket.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      socket.emit('socket:error', {
        message: 'Invalid or expired access token',
      });
      socket.disconnect(true);
    }
  }

  handleDisconnect(): void {}

  @SubscribeMessage('match:join')
  async joinMatch(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { eventId: string; matchId: string },
  ) {
    await this.disputeChatService.authorizeMatchAccess(
      body.eventId,
      body.matchId,
      socket.data.user,
    );
    await socket.join(matchRoom(body.matchId));
    return { ok: true };
  }

  @SubscribeMessage('match:leave')
  async leaveMatch(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { eventId: string; matchId: string },
  ) {
    await this.disputeChatService.authorizeMatchAccess(
      body.eventId,
      body.matchId,
      socket.data.user,
    );
    await socket.leave(matchRoom(body.matchId));
    return { ok: true };
  }

  @SubscribeMessage('chat:send')
  async sendChat(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody()
    body: { eventId: string; matchId: string; message: CreateChatMessageDto },
  ) {
    const message = await this.disputeChatService.sendMessage(
      body.eventId,
      body.matchId,
      socket.data.user,
      body.message,
    );
    return message;
  }

  private broadcast(event: RealtimeEvent): void {
    this.server.to(matchRoom(event.matchId)).emit(event.type, event.payload);
  }

  private extractToken(socket: AuthenticatedSocket): string {
    const auth = socket.handshake.auth as Record<string, unknown> | undefined;
    const authToken = auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0)
      return authToken.replace(/^Bearer\s+/i, '');

    const header = socket.handshake.headers.authorization as
      string | string[] | undefined;
    if (typeof header === 'string') return header.replace(/^Bearer\s+/i, '');
    throw new Error('Missing access token');
  }
}
