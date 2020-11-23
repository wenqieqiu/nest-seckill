import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CreateOrderDTO, UpdateOrderDTO } from './order.dto'
import { Order } from './order.entity'
import { OrderService } from './order.service'

@ApiTags('订单管理')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('/all')
  @ApiOperation({ description: '获取所有订单' })
  order(): Promise<Order[]> {
    return this.orderService.getAllOrder()
  }

  @ApiOperation({ description: '通过ID获取订单' })
  @Get(':id')
  async getRoleById(@Param('id') id: string) {
    const role = await this.orderService.findOneById(id)
    return role
  }

  @ApiOperation({ description: '新增订单' })
  @Post()
  async addRole(@Body() roleInfo: CreateOrderDTO) {
    const saveResult = await this.orderService.saveOne(roleInfo)

    return saveResult
  }

  @ApiOperation({ description: '更新订单信息' })
  @Put()
  async updateRole(@Body() role: UpdateOrderDTO) {
    const { id: roleId, ...roleInfo } = role

    const saveResult = await this.orderService.updateOne(roleId, roleInfo)
    return saveResult
  }

  @ApiOperation({ description: '删除订单' })
  @ApiBody({
    schema: {
      example: ['1sf6g4s8g4sg'],
    },
  })
  @Delete()
  async deleteRole(@Body() roleIds: string[]) {
    const deleteResult = await this.orderService.deleteByIds(roleIds)
    return deleteResult
  }
}
