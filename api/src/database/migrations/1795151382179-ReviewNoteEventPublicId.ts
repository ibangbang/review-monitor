import { MigrationInterface, QueryRunner } from "typeorm";

export class ReviewNoteEventPublicId1795151382179 implements MigrationInterface {
    name = 'ReviewNoteEventPublicId1795151382179'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`review_events\` ADD \`public_id\` char(26) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`review_events\` ADD UNIQUE INDEX \`IDX_061790d731f36d0aa75d3c6384\` (\`public_id\`)`);
        await queryRunner.query(`ALTER TABLE \`review_notes\` ADD \`public_id\` char(26) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`review_notes\` ADD UNIQUE INDEX \`IDX_184bc67b30f8960fa466d6eefd\` (\`public_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`review_notes\` DROP INDEX \`IDX_184bc67b30f8960fa466d6eefd\``);
        await queryRunner.query(`ALTER TABLE \`review_notes\` DROP COLUMN \`public_id\``);
        await queryRunner.query(`ALTER TABLE \`review_events\` DROP INDEX \`IDX_061790d731f36d0aa75d3c6384\``);
        await queryRunner.query(`ALTER TABLE \`review_events\` DROP COLUMN \`public_id\``);
    }

}
