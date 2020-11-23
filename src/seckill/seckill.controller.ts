import { Body, Controller, Logger, Post, Put } from '@nestjs/common'
import { CreateOrderDTO } from '../order/order.dto'
import { SeckillService } from './seckill.service'
import * as uuid from 'uuid-random'
import { awaitWrap } from '@/utils/index'
import { ApiBody } from '@nestjs/swagger'

@Controller('seckill')
export class SeckillController {
  logger = new Logger('SeckillController')

  constructor(private readonly seckillService: SeckillService) {}

  @Post('/add')
  async addOrder(@Body() order: CreateOrderDTO) {
    const params: CreateOrderDTO = {
      ...order,
      openid: `${uuid()}-${new Date().valueOf()}`,
    }

    const [error, result] = await awaitWrap(this.seckillService.secKill(params))

    return error || result
  }

  @Put('/reset')
  @ApiBody({
    schema: {
      example: { count: 100 },
    },
  })
  async resetOrderRemain(@Body() config: any) {
    const remainCount = config?.count || 0

    if (remainCount < 0) return '剩余数量不可小于0！'

    return this.seckillService.setRemainCount(remainCount)
  }
}
