import { MigrateResolve } from '../commands/MigrateResolve'
import { consoleContext, Context } from './__helpers__/context'
import {
  SetupParams,
  setupPostgres,
  tearDownPostgres,
} from '../utils/setupPostgres'

const ctx = Context.new().add(consoleContext()).assemble()

describe('common', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
  it('should fail if no flag', async () => {
    ctx.fixture('empty')
    const result = MigrateResolve.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Early Access. There may be bugs and it's not recommended to use it in production environments.
                  Please provide the --early-access-feature flag to use this command.
          `)
  })
  it('should fail if no --applied or --rolledback', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `--applied or --rolledback must be part of the command like prisma migrate resolve --early-access-feature --applied="20201231000000_example"`,
    )
  })
  it('should fail if both --applied or --rolledback', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateResolve.new().parse([
      '--early-access-feature',
      '--applied=something_applied',
      '--rolledback=something_rolledback',
    ])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `Pass either --applied or --rolledback, not both.`,
    )
  })
})

describe('sqlite', () => {
  it('should fail if no sqlite db - empty schema', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateResolve.new().parse([
      '--schema=./prisma/empty.prisma',
      '--early-access-feature',
      '--applied=something_applied',
    ])
    await expect(result).rejects.toMatchInlineSnapshot(
      `P1003: SQLite database file doesn't exist`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/empty.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  //
  // --applied
  //

  it("--applied should fail if migration doesn't exist", async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse([
      '--early-access-feature',
      '--applied=does_not_exist',
    ])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Failed to read migration script

          `)
  })

  it('--applied should fail if migration is already applied', async () => {
    ctx.fixture('existing-db-1-migration')
    const result = MigrateResolve.new().parse([
      '--early-access-feature',
      '--applied=20201014154943_init',
    ])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            The migration \`20201231000000_init\` is already recorded as applied in the database.

          `)
  })

  it('--applied should fail if migration is not in a failed state', async () => {
    ctx.fixture('existing-db-1-migration')
    const result = MigrateResolve.new().parse([
      '--early-access-feature',
      '--applied',
      '20201014154943_init',
    ])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            The migration \`20201231000000_init\` is already recorded as applied in the database.

          `)
  })

  it('--applied should work on a failed migration', async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse([
      '--early-access-feature',
      '--applied',
      '20201106130852_failed',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Migration 20201231000000_failed marked as applied.`,
    )
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  //
  // --rolledback
  //

  it("--rolledback should fail if migration doesn't exist", async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse([
      '--early-access-feature',
      '--rolledback=does_not_exist',
    ])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Migration \`does_not_exist\` cannot be rolled back because it was never applied to the database.

          `)
  })

  it('--rolledback should fail if migration is not in a failed state', async () => {
    ctx.fixture('existing-db-1-migration')
    const result = MigrateResolve.new().parse([
      '--early-access-feature',
      '--rolledback',
      '20201014154943_init',
    ])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Migration \`20201231000000_init\` cannot be rolled back because it is not in a failed state.

          `)
  })

  it('--rolledback should work on a failed migration', async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse([
      '--early-access-feature',
      '--rolledback',
      '20201106130852_failed',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Migration 20201231000000_failed marked as rolled back.`,
    )
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('--rolledback works if migration is already rolled back', async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse([
      '--early-access-feature',
      '--rolledback',
      '20201106130852_failed',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Migration 20201231000000_failed marked as rolled back.`,
    )

    // Try again
    const result2 = MigrateResolve.new().parse([
      '--early-access-feature',
      '--rolledback',
      '20201106130852_failed',
    ])
    await expect(result2).resolves.toMatchInlineSnapshot(
      `Migration 20201231000000_failed marked as rolled back.`,
    )

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Prisma schema loaded from prisma/schema.prisma
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })
})

describe('postgresql', () => {
  //   const SetupParams: SetupParams = {
  //     connectionString:
  //       process.env.TEST_POSTGRES_URI_MIGRATE ||
  //       'postgres://prisma:prisma@localhost:5432/tests-migrate',
  //     dirname: './fixtures',
  //   }

  //   beforeEach(async () => {
  //     await setupPostgres(SetupParams).catch((e) => {
  //       console.error(e)
  //     })
  //   })

  //   afterEach(async () => {
  //     await tearDownPostgres(SetupParams).catch((e) => {
  //       console.error(e)
  //     })
  //   })

  it('should fail if no postgres db - invalid url', async () => {
    ctx.fixture('schema-only-postgresql')
    jest.setTimeout(6000)

    const result = MigrateResolve.new().parse([
      '--schema=./prisma/invalid-url.prisma',
      '--early-access-feature',
      '--applied=something_applied',
    ])
    await expect(result).rejects.toMatchInlineSnapshot(`
            P1001: Can't reach database server at \`doesnotexist\`:\`5432\`

            Please make sure your database server is running at \`doesnotexist\`:\`5432\`.
          `)

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(
      `Prisma schema loaded from prisma/invalid-url.prisma`,
    )
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })
})