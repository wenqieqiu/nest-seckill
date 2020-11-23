import { Injectable } from '@nestjs/common'
import { RedisService } from 'nestjs-redis'

@Injectable()
export class RedisClientService {
  constructor(private readonly redisService: RedisService) {}

  //连接配置已在app.module设置
  async getSeckillRedisClient() {
    return await this.redisService.getClient('seckill')
  }
}
