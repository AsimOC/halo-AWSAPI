const { EVENT_TABLES: TABLES, USER_TABLES, SCHEMAS } = require("../db/tables");
const schema = SCHEMAS.PUBLIC;

const getGroupsQuery = ({
  limit,
  offset,
  sort,
  clientID
}) => `
select ug.*, row_to_json(cc.*) as client, users.users as users
  FROM ${USER_TABLES.GROUP} ug
  LEFT JOIN ${USER_TABLES.CLIENT} cc on ug.client_id = cc.id
  LEFT JOIN (
    SELECT ug.id as group_id,
    array_to_json(
        array_agg(uu.object_id)
    ) as users
    from ${USER_TABLES.GROUP} as ug
    LEFT JOIN ${USER_TABLES.GROUP_USERS} as ugu on ugu.group_id = ug.id
    LEFT JOIN ${USER_TABLES.USER} as uu on uu.id = ugu.user_id
    where not uu.deleted
    GROUP BY ug.id
  ) as users on users.group_id = ug.id
  ${ clientID ? `WHERE not ug.deleted AND ug.client_id = ${clientID}` : `WHERE not ug.deleted` }
  ORDER BY ug.name ${sort} OFFSET ${offset} LIMIT ${limit};`;

const getGroupQuery = (object_id) => `
select ug.*, row_to_json(cc.*) as client, users.users as users
  FROM ${USER_TABLES.GROUP} ug
  LEFT JOIN ${USER_TABLES.CLIENT} cc on ug.client_id = cc.id
  LEFT JOIN (
    SELECT ug.id as group_id,
    array_to_json(
        array_agg(uu.object_id)
    ) as users
    from ${USER_TABLES.GROUP} as ug
    LEFT JOIN ${USER_TABLES.GROUP_USERS} as ugu on ugu.group_id = ug.id
    LEFT JOIN ${USER_TABLES.USER} as uu on uu.id = ugu.user_id
    where not uu.deleted
    GROUP BY ug.id
  ) as users on users.group_id = ug.id WHERE not ug.deleted AND ug.object_id = ${object_id};`;

const createGroupQuery = ( fields, values) => `INSERT INTO ${schema}.${USER_TABLES.GROUP} (${fields})
                                                      VALUES (${values}) 
                                                      RETURNING *;`;

const createGroupUserRelationQuery = ( values ) => `INSERT INTO ${schema}.${USER_TABLES.GROUP_USERS} (user_id, group_id)
                                                      VALUES ${values};`;


module.exports = {
  getGroupQuery,
  getGroupsQuery,
  createGroupQuery,
  createGroupUserRelationQuery
};
