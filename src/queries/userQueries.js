const { EVENT_TABLES: TABLES, USER_TABLES, SCHEMAS } = require("../db/tables");

const getUserQuery = (id) => `
        SELECT  
            row_to_json(usr.*) as user, 
            row_to_json(ev.*) as current_event 
            FROM ${USER_TABLES.USER} as usr 
            LEFT JOIN (SELECT * FROM ${TABLES.EVENT} WHERE NOT deleted) as ev 
                    ON ev.id = usr.current_event_id
            WHERE usr.id = ${id};`;

module.exports = {
  getUserQuery,
};
