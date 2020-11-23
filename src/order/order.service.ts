import { Injectable } from '@nestjs/common'
import { Connection, Repository, FindOneOptions } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { Order } from './order.entity'

@Injectable()
export class OrderService {
  orderConnection!: Connection

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>
  ) {
    this.orderConnection = this.orderRepository.manager.connection
  }

  async getAllOrder(options: FindOneOptions<Order> = {}) {
    return this.orderRepository.find(options)
  }

  async saveOne(order: Partial<Order>) {
    await this.orderConnection.queryResultCache.clear()
    return this.orderRepository.save(order)
  }

  async updateOne(orderId: number | string, order: Partial<Order>) {
    await this.orderConnection.queryResultCache.clear()
    return this.orderRepository.update(orderId, order)
  }

  findOneById(id: string | number) {
    return this.orderRepository.findOne(id, { cache: true })
  }

  async deleteById(id: number) {
    await this.orderConnection.queryResultCache.clear()
    return this.orderRepository.delete(id)
  }

  async deleteByIds(ids: string[]) {
    await this.orderConnection.queryResultCache.clear()
    return this.orderRepository.delete(ids)
  }
}
