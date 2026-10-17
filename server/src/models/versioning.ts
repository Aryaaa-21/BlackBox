import { Schema } from 'mongoose';

/** One authoritative counter: Mongoose's existing __v, exposed as version. */
export function exposeVersion(schema: Schema): void {
  schema.set('optimisticConcurrency', true);
  schema.virtual('version').get(function () { return this.get('__v') ?? 0; });
  // Mongoose increments __v on optimistic document saves. Its query update
  // helpers need the equivalent increment (they do not run save middleware).
  schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function () {
    const update = this.getUpdate();
    if (!update) return;
    if (Array.isArray(update)) {
      // The event clock is metadata, not an edit to mission state/version.
      const first = update[0];
      const clockOnly = update.length === 1 && first && '$set' in first &&
        Object.keys(first.$set).length === 1 && 'eventClock' in first.$set;
      if (!clockOnly) update.push({ $set: { __v: { $add: [{ $ifNull: ['$__v', 0] }, 1] } } });
      return;
    }
    delete update.__v;
    for (const operator of ['$set', '$setOnInsert', '$unset']) {
      if (update[operator]) delete update[operator].__v;
    }
    update.$inc = { ...update.$inc, __v: 1 };
  });
  // Lean API reads bypass virtuals; expose the exact same persisted counter.
  schema.post(['find', 'findOne', 'findOneAndUpdate'], function (result) {
    if (!this.mongooseOptions().lean) return;
    for (const document of Array.isArray(result) ? result : [result]) {
      if (document) document.version = document.__v ?? 0;
    }
  });
}
