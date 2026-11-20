import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationRulePublicId1795151462006 implements MigrationInterface {
    name = 'NotificationRulePublicId1795151462006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`notification_rules\` ADD \`public_id\` char(26) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`notification_rules\` ADD UNIQUE INDEX \`IDX_145566478d7417be5e251e854d\` (\`public_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`notification_rules\` DROP INDEX \`IDX_145566478d7417be5e251e854d\``);
        await queryRunner.query(`ALTER TABLE \`notification_rules\` DROP COLUMN \`public_id\``);
    }

}
