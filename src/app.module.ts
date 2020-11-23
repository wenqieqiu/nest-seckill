import { CacheModule, Module } from '@nestjs/common'
import { RedisModule } from 'nestjs-redis'
import { join } from 'path'
import * as redisStore from 'cache-manager-redis-store'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { TypeOrmModule } from '@nestjs/typeorm'
import { getConfig } from '../config/index'
import { OrderModule } from './order/order.module'
import { SeckillService } from './seckill/seckill.service'
import { SeckillModule } from './seckill/seckill.module'
import { RedisClientService } from './redis/redis.service'

const { database, redisCache, redisSeckill } = getConfig()

const entities = process.env.NODE_ENV === 'production' ? ['*.entity.js'] : [join(__dirname, '**', '*.entity.{ts,js}')]

const TypeOrmModuleInstance = TypeOrmModule.forRoot({
  type: 'mysql',
  host: database.ip,
  port: database.port,
  username: database.username,
  password: database.password,
  database: database.database,
  entities: entities,
  synchronize: process.env.NODE_ENV !== 'production',
  //nest属性
  autoLoadEntities: true,
  retryAttempts: 3,
  cache: {
    type: 'redis',
    options: {
      host: redisCache.host,
      port: redisCache.port,
    },
    duration: redisCache.duration,
  },
})

@Module({
  imports: [
    TypeOrmModuleInstance,
    CacheModule.register({
      store: redisStore,
      host: redisCache.host,
      port: redisCache.port,
      ttl: 10, // seconds
      max: 999, // maximum number of items in cache
    }),
    //redis-io连接配置,用于手动操作redis
    RedisModule.register([redisSeckill]),
    OrderModule,
    SeckillModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeckillService, RedisClientService],
})
export class AppModule {}
