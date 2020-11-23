import { ApiProperty, PickType } from '@nestjs/swagger'
import { Order } from './order.entity'

export class CreateOrderDTO extends PickType(Order, ['user', 'goods', 'openid', 'remark', 'kafkaRawMessage']) {}

export class UpdateOrderDTO extends PickType(Order, ['user', 'goods', 'openid', 'remark', 'kafkaRawMessage']) {
  @ApiProperty({ description: '订单id', example: '' })
  id: string
}
