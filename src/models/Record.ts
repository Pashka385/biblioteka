import { applyFilter } from '@/helpers/filter'
import { sign } from '@/helpers/jwt'
import { Book } from '@/models/Book'
import { User } from '@/models/User'
import RecordInfo from '@/validators/RecordInfo'
import { notFound } from '@hapi/boom'
import {
  DocumentType,
  Ref,
  getModelForClass,
  modelOptions,
  prop,
} from '@typegoose/typegoose'
import { omit } from 'lodash'

@modelOptions({
  schemaOptions: { timestamps: true },
})
export class Record {
  @prop({ index: true, required: true, ref: () => User })
  user!: Ref<User>
  @prop({ index: true, required: true, ref: () => Book })
  book!: Ref<Book>
  @prop({ index: true, required: true })
  returnDate!: string
  @prop({ index: true })
  retrievalDate?: string

  @prop({ index: true, unique: true })
  token?: string

  strippedAndFilled(this: DocumentType<Record>) {
    const stripFields = ['createdAt', 'updatedAt', '__v']
    return omit(this.toObject(), stripFields)
  }
}

export const RecordModel = getModelForClass(Record)

export async function findRecords(
  filter: Map<string, unknown>,
  page: number = 0
) {
  const limit = 10
  const skip = page * limit

  const records = await RecordModel.find(applyFilter(filter))
    .skip(skip)
    .limit(limit)
    .populate('user path')
  if (!records) throw notFound('No records found')

  return records
}

export async function findOrCreateRecord({
  user,
  book,
  returnDate,
  retrievalDate,
  token,
}: RecordInfo) {
  let record = await RecordModel.findOne({
    $or: [{ token }, { book, user, returnDate, retrievalDate }],
  })
  if (!user && !token && user && book && returnDate) {
    record = await RecordModel.findOneAndUpdate(
      Object.fromEntries(
        Object.entries({ book, user, returnDate, retrievalDate }).filter(
          ([, v]) => v
        )
      ),
      {},
      {
        new: true,
        upsert: true,
      }
    )
  }

  if (!record) {
    throw notFound('User not found')
  }
  if (!record.token) {
    record.token = await sign({ id: record.id })
    await record.save()
  }
  return record
}
