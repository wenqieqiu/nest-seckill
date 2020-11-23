import * as kafka from 'kafka-node'
import { getConfig } from '@root/config/index'

const { kafkaConfig } = getConfig()

let kafkaConsumer!: kafka.Consumer

function getKafkaClient() {
  let kafkaClient!: kafka.KafkaClient

  return () => {
    if (!kafkaClient) {
      kafkaClient = new kafka.KafkaClient({
        kafkaHost: kafkaConfig.kafkaHost,
      })
    }

    return kafkaClient
  }
}

/**
 * @desc 初始化Topic
 */
export function initKafkaTopic(): Promise<any> {
  const kafkaClient = getKafkaClient()()

  const Producer = kafka.Producer

  const producer = new Producer(kafkaClient, {
    requireAcks: 1,
    ackTimeoutMs: 100,
    partitionerType: 2,
  })

  const payload = [
    {
      topic: kafkaConfig.topic,
      partition: 0,
      messages: [JSON.stringify({})],
    },
  ]

  return new Promise((resolve, reject) => {
    producer.send(payload, (err, data) => {
      if (err) {
        console.error(err)
        reject(err)
        return err
      }

      console.log(data)
      resolve(data)
    })
  })
}

/**
 * @desc 获取消费者实例
 */
export function getKafkaConsumer() {
  const topics = [
    {
      topic: kafkaConfig.topic,
      partition: 0,
      offset: 0,
    },
  ]

  const options = {
    //  自动提交配置   (false 不会提交偏移量，每次都从头开始读取)
    autoCommit: true,
    autoCommitIntervalMs: 5000,
    //  如果设置为true，则consumer将从有效负载中的给定偏移量中获取消息
    fromOffset: false,
  }

  const kafkaClient = getKafkaClient()()

  if (!kafkaConsumer) {
    kafkaConsumer = new kafka.Consumer(kafkaClient, topics, options)
  }

  return kafkaConsumer
}
