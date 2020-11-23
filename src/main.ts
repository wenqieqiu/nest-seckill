import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as chalk from 'chalk'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import * as packageJson from '../package.json'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const options = new DocumentBuilder()
    .setTitle(`${packageJson.name}-client`)
    .setDescription(`${packageJson.description}-[ 客户端后台服务 ]`)
    .setVersion(packageJson.version)
    .setLicense(packageJson.license, '')
    .setContact(packageJson.author, '', packageJson.author)
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, options)
  SwaggerModule.setup('api-docs', app, document)

  await app.listen(3000)

  console.log(chalk.blue('\n服务已启动在 http://localhost:3000\n'))

  console.log(chalk.blue(`\nswagger-ui服务已开启在 http://localhost:3000/api-docs\n`))
}
bootstrap()
