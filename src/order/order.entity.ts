import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column } from 'typeorm'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  readonly id: string

  @ApiProperty({ description: '用户', example: 'user1' })
  @Column()
  user: string

  @ApiProperty({ description: '商品', example: '小米11' })
  goods: string

  @Column({ unique: true })
  openid: string

  @Column()
  remainCount: number //剩余数量

  @ApiPropertyOptional({ description: '订单备注', example: '双十一特惠' })
  @Column()
  remark?: string

  @ApiPropertyOptional({ description: '创建时间' })
  @CreateDateColumn()
  readonly createdDate?: Date

  @ApiPropertyOptional({ description: '更新时间' })
  @UpdateDateColumn()
  readonly updateDate?: Date

  @Column()
  kafkaRawMessage?: string //从kafka获取的消费原始数据
}
