const { EVENT_TABLES: TABLES, USER_TABLES, SCHEMAS } = require("../db/tables");
const schema = SCHEMAS.PUBLIC;

const getEventQuery = ({
  id,
  clientID = null,
}) => `SELECT row_to_json(ev.*) as event,
	  row_to_json(cl.*) as client,
	  row_to_json(cnby.*) as controlled_by,
	  row_to_json(cby.*) as created_by,
	  row_to_json(dby.*) as deleted_by,
	  row_to_json(uby.*) as updated_by,
    COALESCE(users.users, '[]') as users,
    ef.locations as locations
	  from ${TABLES.EVENT} as ev
      LEFT JOIN ${USER_TABLES.CLIENT} as cl 
        ON cl.id = ev.client_id
      LEFT JOIN ${USER_TABLES.USER} as cnby 
        ON cnby.id = ev.controlled_by_id
      LEFT JOIN ${USER_TABLES.USER} as cby 
        ON cby.id = ev.created_by_id
      LEFT JOIN ${USER_TABLES.USER} as dby 
        ON dby.id = ev.deleted_by_id
      LEFT JOIN ${USER_TABLES.USER} as uby 
        ON uby.id = ev.updated_by_id
      LEFT JOIN 
        (SELECT ev.id as event_id, array_to_json(array_agg(us.object_id)) as users from 
          ${TABLES.EVENT} as ev
          LEFT JOIN ${TABLES.EVENT_USERS} as usrs
            on usrs.event_id = ev.id 
          LEFT JOIN ${USER_TABLES.USER} as us
            on us.id = usrs.user_id
          GROUP BY ev.id) AS users
	  	  ON users.event_id = ev.id
      LEFT JOIN  
	  	 (SELECT ev.id as event_id, array_to_json(array_agg(
	        json_build_object(
					 'name', ef.name,
					 'points', ST_AsGeoJSON(ef.points)::jsonb,
					 'object_id', ef.object_id,
           'updated_at', ef.updated_at
					) ORDER BY ef.updated_at ASC )) as locations
	  		  FROM ${TABLES.EVENT_GEO} as ef
			    LEFT JOIN ${TABLES.EVENT} as ev
				    ON ev.id = ef.event_id where Not ef.deleted GROUP BY ev.id) as ef
	      ON ef.event_id = ev.id
    WHERE ev.object_id = '${id}' AND NOT ev.deleted ${
  clientID ? `AND ev.client_id = ${clientID}` : ""
};`;

const getEventsQuery = ({
  limit,
  offset,
  sort,
  clientID = null,
}) => `SELECT row_to_json(ev.*) as event,
	  row_to_json(cl.*) as client,
	  row_to_json(cnby.*) as controlled_by,
	  row_to_json(cby.*) as created_by,
	  row_to_json(dby.*) as deleted_by,
	  row_to_json(uby.*) as updated_by,
    COALESCE(users.users, '[]') as users,
    ef.locations as locations
	  from ${TABLES.EVENT} as ev
      LEFT JOIN ${USER_TABLES.CLIENT} as cl 
        ON cl.id = ev.client_id
      LEFT JOIN ${USER_TABLES.USER} as cnby 
        ON cnby.id = ev.controlled_by_id
      LEFT JOIN ${USER_TABLES.USER} as cby 
        ON cby.id = ev.created_by_id
      LEFT JOIN ${USER_TABLES.USER} as dby 
        ON dby.id = ev.deleted_by_id
      LEFT JOIN ${USER_TABLES.USER} as uby 
        ON uby.id = ev.updated_by_id
      LEFT JOIN 
        (SELECT ev.id as event_id, array_to_json(array_agg(us.object_id)) as users from 
          ${TABLES.EVENT} as ev
          LEFT JOIN ${TABLES.EVENT_USERS} as usrs
            on usrs.event_id = ev.id 
          LEFT JOIN ${USER_TABLES.USER} as us
            on us.id = usrs.user_id
          GROUP BY ev.id) AS users
	  	  ON users.event_id = ev.id
      LEFT JOIN  
	  	 (SELECT ev.id as event_id, array_to_json(array_agg(
	        json_build_object(
					 'name', ef.name,
					 'points', ST_AsGeoJSON(ef.points)::jsonb,
					 'object_id', ef.object_id,
           'updated_at', ef.updated_at
					) ORDER BY ef.updated_at ASC )) as locations
	  		  FROM ${TABLES.EVENT_GEO} as ef
			    LEFT JOIN ${TABLES.EVENT} as ev
				    ON ev.id = ef.event_id where Not ef.deleted GROUP BY ev.id) as ef
	      ON ef.event_id = ev.id
    WHERE NOT ev.deleted ${
      clientID ? `AND ev.client_id = ${clientID}` : ""
    } ORDER BY ev.start_date ${sort} OFFSET ${offset} LIMIT ${limit};`;

const getUserEventsQuery = ({
  limit,
  offset,
  sort,
  userIntID,
}) => `SELECT row_to_json(ev.*) as event,
	  row_to_json(cl.*) as client,
	  row_to_json(cnby.*) as controlled_by,
	  row_to_json(cby.*) as created_by,
	  row_to_json(dby.*) as deleted_by,
	  row_to_json(uby.*) as updated_by,
    COALESCE(users.users, '[]') as users,
    ef.locations as locations
	  from ${TABLES.EVENT} as ev
      JOIN ${TABLES.EVENT_USERS} as ev_users
		    ON ev_users.event_id = ev.id
      LEFT JOIN ${USER_TABLES.CLIENT} as cl 
        ON cl.id = ev.client_id
      LEFT JOIN ${USER_TABLES.USER} as cnby 
        ON cnby.id = ev.controlled_by_id
      LEFT JOIN ${USER_TABLES.USER} as cby 
        ON cby.id = ev.created_by_id
      LEFT JOIN ${USER_TABLES.USER} as dby 
        ON dby.id = ev.deleted_by_id
      LEFT JOIN ${USER_TABLES.USER} as uby 
        ON uby.id = ev.updated_by_id
      LEFT JOIN 
        (SELECT ev.id as event_id, array_to_json(array_agg(us.object_id)) as users from 
          ${TABLES.EVENT} as ev
          LEFT JOIN ${TABLES.EVENT_USERS} as usrs
            on usrs.event_id = ev.id 
          LEFT JOIN ${USER_TABLES.USER} as us
            on us.id = usrs.user_id
          GROUP BY ev.id) AS users
	  	  ON users.event_id = ev.id
      LEFT JOIN  
	  	 (SELECT ev.id as event_id, array_to_json(array_agg(
	        json_build_object(
					 'name', ef.name,
					 'points', ST_AsGeoJSON(ef.points)::jsonb,
					 'object_id', ef.object_id,
           'updated_at', ef.updated_at
					) ORDER BY ef.updated_at ASC )) as locations
	  		  FROM ${TABLES.EVENT_GEO} as ef
			    LEFT JOIN ${TABLES.EVENT} as ev
				    ON ev.id = ef.event_id where Not ef.deleted GROUP BY ev.id) as ef
	      ON ef.event_id = ev.id
      where ev_users.user_id = ${userIntID} AND NOT ev.deleted
      ORDER BY ev.start_date ${sort} OFFSET ${offset} LIMIT ${limit};`;

const getEventCheckQuery = (id) => `SELECT row_to_json(ec.*) as eventcheck,
        row_to_json(ev.*) as event,
        row_to_json(comby.*) as completed_by,
        row_to_json(cby.*) as created_by,
        row_to_json(dby.*) as deleted_by,
        row_to_json(uby.*) as updated_by,
        row_to_json(ac.*) as admin_check
        FROM ${TABLES.EVENT_CHECK} as ec
          LEFT JOIN ${TABLES.EVENT} as ev
              ON ev.id = ec.event_id
          LEFT JOIN ${USER_TABLES.USER} as comby
              ON comby.id = ec.completed_by_id
          LEFT JOIN ${USER_TABLES.USER} as cby
              ON cby.id = ec.created_by_id
          LEFT JOIN ${USER_TABLES.USER} as dby
              ON dby.id = ec.deleted_by_id
          LEFT JOIN ${USER_TABLES.USER} as uby
              ON uby.id = ec.updated_by_id
          LEFT JOIN ${TABLES.EVENT_ADMIN_CHECK} as ac
		  	      ON ac.id = ec.admin_check_id
        WHERE ec.id = ${id};`;

const getEventChecksQuery = ({
  limit,
  offset,
  sort,
}) => `SELECT row_to_json(ec.*) as eventcheck,
        row_to_json(ev.*) as event,
        row_to_json(comby.*) as completed_by,
        row_to_json(cby.*) as created_by,
        row_to_json(dby.*) as deleted_by,
        row_to_json(uby.*) as updated_by,
        row_to_json(ac.*) as admin_check
        FROM ${TABLES.EVENT_CHECK} as ec
          LEFT JOIN ${TABLES.EVENT} as ev
              ON ev.id = ec.event_id
          LEFT JOIN ${USER_TABLES.USER} as comby
              ON comby.id = ec.completed_by_id
          LEFT JOIN ${USER_TABLES.USER} as cby
              ON cby.id = ec.created_by_id
          LEFT JOIN ${USER_TABLES.USER} as dby
              ON dby.id = ec.deleted_by_id
          LEFT JOIN ${USER_TABLES.USER} as uby
              ON uby.id = ec.updated_by_id
          LEFT JOIN ${TABLES.EVENT_ADMIN_CHECK} as ac
		  	      ON ac.id = ec.admin_check_id
        ORDER BY ec.created_at ${sort} OFFSET ${offset} LIMIT ${limit};`;

const getEventCheckMessageQuery = (id) => `Select 
      row_to_json(ecm.*) as eventcheckmessage, 
      row_to_json(ec.*) as event_check, 
      row_to_json(usr.*) as user,
      row_to_json(cby_u.*) as created_by,
      row_to_json(uby_u.*) as updated_by,
      row_to_json(dby_u.*) as deleted_by
      from ${TABLES.EVENT_CHECK_MESSAGE} as ecm
        Left JOIN ${TABLES.EVENT_CHECK} as ec 
          ON ec.id = ecm.event_check_id
        Left JOIN ${USER_TABLES.USER} as usr 
          ON usr.id = ecm.user_id
        Left JOIN ${USER_TABLES.USER} as cby_u 
          ON cby_u.id = ecm.created_by_id
        Left JOIN ${USER_TABLES.USER} as uby_u 
          ON uby_u.id = ecm.updated_by_id
        Left JOIN ${USER_TABLES.USER} as dby_u 
          ON dby_u.id = ecm.deleted_by_id
        WHERE ecm.id = ${id};`;

const getEventCheckMessagesQuery = ({ limit, offset, sort }) => `Select 
      row_to_json(ecm.*) as eventcheckmessage, 
      row_to_json(ec.*) as event_check, 
      row_to_json(usr.*) as user,
      row_to_json(cby_u.*) as created_by,
      row_to_json(uby_u.*) as updated_by,
      row_to_json(dby_u.*) as deleted_by
      from ${TABLES.EVENT_CHECK_MESSAGE} as ecm
        Left JOIN ${TABLES.EVENT_CHECK} as ec 
          ON ec.id = ecm.event_check_id
        Left JOIN ${USER_TABLES.USER} as usr 
          ON usr.id = ecm.user_id
        Left JOIN ${USER_TABLES.USER} as cby_u 
          ON cby_u.id = ecm.created_by_id
        Left JOIN ${USER_TABLES.USER} as uby_u 
          ON uby_u.id = ecm.updated_by_id
        Left JOIN ${USER_TABLES.USER} as dby_u 
          ON dby_u.id = ecm.deleted_by_id
      ORDER BY ecm.created_at ${sort} OFFSET ${offset} LIMIT ${limit};`;

const getEventCheckMessageViewQuery = (
  id
) => `SELECT row_to_json(mv.*) as eventcheckmessageview, 
            row_to_json(em.*) as message,
            row_to_json(us.*) as user
            from ${TABLES.EVENT_CHECK_MESSAGE_VIEW} as mv
            Join ${TABLES.EVENT_CHECK_MESSAGE} as em
            ON mv.message_id = em.id
            JOIN ${USER_TABLES.USER} as us 
			      ON us.id = mv.user_id
            WHERE mv.id = ${id};
            `;

const getEventCheckMessageViewsQuery = ({
  limit,
  offset,
  sort,
}) => `SELECT row_to_json(mv.*) as eventcheckmessageview , 
            row_to_json(em.*) as message,
            row_to_json(us.*) as user
            from ${TABLES.EVENT_CHECK_MESSAGE_VIEW} as mv
            Join ${TABLES.EVENT_CHECK_MESSAGE} as em
            ON mv.message_id = em.id
            JOIN ${USER_TABLES.USER} as us 
			      ON us.id = mv.user_id
            Order By mv.viewed_at ${sort} OFFSET ${offset} LIMIT ${limit};
            `;

const getStaffByEventQuery = ({
  limit,
  offset,
  sort,
  event_id
}) => `select uu.*, events.events as event_ids, row_to_json(cc.*) as client from ${USER_TABLES.USER} uu
  left join ${USER_TABLES.CLIENT} cc on uu.client_id = cc.id
  LEFT JOIN (SELECT uu.id as user_id, array_to_json(array_agg(ev.object_id)) as events from
  ${USER_TABLES.USER} as uu
    LEFT JOIN ${TABLES.EVENT_USERS} as usrs
              on usrs.user_id  = uu.id
    LEFT JOIN ${TABLES.EVENT} as ev
              on ev.id = usrs.event_id
   where not ev.deleted
   GROUP BY uu.id) as events on uu.id = events.user_id
    inner join ${TABLES.EVENT_USERS} eeu on eeu.user_id = uu.id
    inner join ${TABLES.EVENT} ee on eeu.event_id = ee.id
       where uu.deleted = false and ee.object_id = ${event_id}
        Order By uu.name ${sort} OFFSET ${offset} LIMIT ${limit};
`;

module.exports = {
  getEventQuery,
  getEventsQuery,
  getStaffByEventQuery,
  getUserEventsQuery,
  getEventCheckQuery,
  getEventChecksQuery,
  getEventCheckMessageQuery,
  getEventCheckMessagesQuery,
  getEventCheckMessageViewQuery,
  getEventCheckMessageViewsQuery,
};
