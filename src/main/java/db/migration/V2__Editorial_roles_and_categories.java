package db.migration;

import java.util.ArrayList;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

public class V2__Editorial_roles_and_categories extends BaseJavaMigration {
  @Override
  public void migrate(Context context) throws Exception {
    var c = context.getConnection();
    // PostgreSQL 18 reports NOT NULL constraints as CHECK in information_schema.
    // Select only native CHECK constraints so primary-key nullability stays intact.
    boolean postgres = c.getMetaData().getDatabaseProductName().equals("PostgreSQL");
    String constraintQuery =
        postgres
            ? "select con.conname from pg_catalog.pg_constraint con"
                + " join pg_catalog.pg_class rel on rel.oid=con.conrelid"
                + " join pg_catalog.pg_namespace ns on ns.oid=rel.relnamespace"
                + " where ns.nspname=current_schema() and rel.relname=? and con.contype='c'"
            : "select constraint_name from information_schema.table_constraints where"
                + " table_schema=current_schema() and table_name=? and constraint_type='CHECK'";
    // V1 used unnamed constraints. Discover their actual names on both H2 and PostgreSQL.
    for (String table : new String[] {"members", "posts"}) {
      var names = new ArrayList<String>();
      try (var q = c.prepareStatement(constraintQuery)) {
        q.setString(1, table);
        try (var r = q.executeQuery()) {
          while (r.next()) names.add(r.getString(1));
        }
      }
      try (var q = c.createStatement()) {
        for (String name : names)
          q.execute(
              "alter table " + table + " drop constraint \"" + name.replace("\"", "\"\"") + "\"");
      }
    }
    try (var q = c.createStatement()) {
      q.execute(
          "alter table members add constraint members_role_check check(role in"
              + " ('READER','WRITER','ADMIN'))");
      q.execute(
          "alter table posts add constraint posts_category_check check(category in"
              + " ('BLOG','FILM','SERIES','HISTORY','TECH','SPORT'))");
      q.execute(
          "alter table posts add constraint posts_rating_check check(rating between 1 and 10)");
      // Every old WRITER was self-registered. Keep content but require admin approval again.
      q.executeUpdate("update members set role='READER' where role='WRITER'");
    }
  }
}
