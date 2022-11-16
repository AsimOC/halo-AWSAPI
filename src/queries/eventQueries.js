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
          WHERE not us.deleted
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

const getEventCheckQuery = (
  object_id
) => `SELECT row_to_json(ec.*) as eventcheck,
        row_to_json(ev.*) as event,
        row_to_json(comby.*) as completed_by,
        row_to_json(cby.*) as created_by,
        row_to_json(dby.*) as deleted_by,
        row_to_json(uby.*) as updated_by,
        row_to_json(ac.*) as admin_check,
        COALESCE(check_users.users, '[]') as users,
        COALESCE(eventcheck_messages.messages, '[]') as messages,
        COALESCE(message_read_by.message_ready_by, '[]') as message_read_list,
		    message_read_by.last_message_created_at as last_message_created_at,
        COALESCE(read_by.read_bys, '[]') as user_views
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
          LEFT JOIN 
            (SELECT check_users.eventcheck_id as eventcheck_id, array_to_json(array_agg(usr.object_id)) as users from 
              ${TABLES.EVENT_CHECK_USERS} as check_users
                JOIN ${USER_TABLES.USER} as usr
                on usr.id = check_users.user_id
                GROUP BY check_users.eventcheck_id) AS check_users
            ON check_users.eventcheck_id = ec.id
          LEFT JOIN 
            (SELECT ev_check.id as eventcheck_id, array_to_json(array_agg(ec_mesg.object_id)) as messages from 
                ${TABLES.EVENT_CHECK} as ev_check
                JOIN ${TABLES.EVENT_CHECK_MESSAGE} as ec_mesg
                ON ev_check.id = ec_mesg.event_check_id 
                GROUP BY ev_check.id) AS eventcheck_messages
            ON eventcheck_messages.eventcheck_id = ec.id
          LEFT JOIN 
            (SELECT msg.event_check_id as event_check_id, msg.created_at as last_message_created_at, array_to_json(array_agg(DISTINCT usr.object_id)) as message_ready_by from 
              ${TABLES.EVENT_CHECK_MESSAGE} as msg
                JOIN ${TABLES.EVENT_CHECK_MESSAGE_VIEW} as message_read_by
                on msg.id = message_read_by.message_id
                JOIN ${USER_TABLES.USER} as usr
                  on message_read_by.user_id = usr.id
                WHERE msg.id IN (SELECT MAX(id)
                      FROM ${TABLES.EVENT_CHECK_MESSAGE}
                      GROUP BY ${TABLES.EVENT_CHECK_MESSAGE}.event_check_id)
                GROUP BY msg.event_check_id, last_message_created_at) AS message_read_by
            ON message_read_by.event_check_id = ec.id
          LEFT JOIN 
            (SELECT read_by.eventcheck_id AS eventcheck_id, array_to_json(array_agg(
                json_build_object( 
                  'id', read_by.id,
                  'user_id', read_by.user_id,
                  'user', usr
                )
              )) AS read_bys
                FROM  ${TABLES.EVENT_CHECK_READ_BY} as read_by
                JOIN ${USER_TABLES.USER} as usr
                  ON usr.id = read_by.user_id
                GROUP BY read_by.eventcheck_id
              ) as read_by
            ON read_by.eventcheck_id = ec.id
      WHERE NOT ec.deleted AND ec.object_id = '${object_id}';`;

const getEventChecksQuery = ({
  eventId,
  limit,
  offset,
  sort,
}) => `SELECT row_to_json(ec.*) as eventcheck,
        row_to_json(ev.*) as event,
        row_to_json(comby.*) as completed_by,
        row_to_json(cby.*) as created_by,
        row_to_json(dby.*) as deleted_by,
        row_to_json(uby.*) as updated_by,
        row_to_json(ac.*) as admin_check,
        COALESCE(check_users.users, '[]') as users,
        COALESCE(eventcheck_messages.messages, '[]') as messages,
        COALESCE(message_read_by.message_ready_by, '[]') as message_read_list,
		    message_read_by.last_message_created_at as last_message_created_at,
        COALESCE(read_by.read_bys, '[]') as user_views
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
          LEFT JOIN 
            (SELECT check_users.eventcheck_id as eventcheck_id, array_to_json(array_agg(usr.object_id)) as users from 
              ${TABLES.EVENT_CHECK_USERS} as check_users
                JOIN ${USER_TABLES.USER} as usr
                on usr.id = check_users.user_id
                GROUP BY check_users.eventcheck_id) AS check_users
            ON check_users.eventcheck_id = ec.id
          LEFT JOIN 
            (SELECT ev_check.id as eventcheck_id, array_to_json(array_agg(ec_mesg.object_id)) as messages from 
                ${TABLES.EVENT_CHECK} as ev_check
                JOIN ${TABLES.EVENT_CHECK_MESSAGE} as ec_mesg
                ON ev_check.id = ec_mesg.event_check_id 
                GROUP BY ev_check.id) AS eventcheck_messages
            ON eventcheck_messages.eventcheck_id = ec.id
          LEFT JOIN 
            (SELECT msg.event_check_id as event_check_id, msg.created_at as last_message_created_at, array_to_json(array_agg(DISTINCT usr.object_id)) as message_ready_by from 
              ${TABLES.EVENT_CHECK_MESSAGE} as msg
                JOIN ${TABLES.EVENT_CHECK_MESSAGE_VIEW} as message_read_by
                on msg.id = message_read_by.message_id
                JOIN ${USER_TABLES.USER} as usr
                  on message_read_by.user_id = usr.id
                WHERE msg.id IN (SELECT MAX(id)
                      FROM ${TABLES.EVENT_CHECK_MESSAGE}
                      GROUP BY ${TABLES.EVENT_CHECK_MESSAGE}.event_check_id)
                GROUP BY msg.event_check_id, last_message_created_at) AS message_read_by
            ON message_read_by.event_check_id = ec.id
          LEFT JOIN 
            (SELECT read_by.eventcheck_id AS eventcheck_id, array_to_json(array_agg(
                json_build_object( 
                  'id', read_by.id,
                  'user_id', read_by.user_id,
                  'user', usr
                )
              )) AS read_bys
                FROM  ${TABLES.EVENT_CHECK_READ_BY} as read_by
                JOIN ${USER_TABLES.USER} as usr
                  ON usr.id = read_by.user_id
                GROUP BY read_by.eventcheck_id
              ) as read_by
            ON read_by.eventcheck_id = ec.id
          WHERE NOT ec.deleted AND NOT ev.deleted AND ev.object_id = '${eventId}'
        ORDER BY ec.occurs_at, ec.id ${sort} OFFSET ${offset} LIMIT ${limit};`;

const getEventCheckMessageQuery = (object_id) => `Select 
      row_to_json(ecm.*) as eventcheckmessage, 
      row_to_json(ec.*) as event_check, 
      row_to_json(usr.*) as user,
      row_to_json(cby_u.*) as created_by,
      row_to_json(uby_u.*) as updated_by,
      row_to_json(dby_u.*) as deleted_by,
      COALESCE(read_by.read_bys, '[]') as user_views
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
        LEFT JOIN 
            (SELECT read_by.message_id AS eventcheckmessage_id, array_to_json(array_agg(
                json_build_object( 
                  'id', read_by.id,
                  'user_id', read_by.user_id,
                  'user', usr,
                  'viewed_at', read_by.viewed_at
                )
              )) AS read_bys
                FROM  ${TABLES.EVENT_CHECK_MESSAGE_VIEW} as read_by
                JOIN ${USER_TABLES.USER} as usr
                  ON usr.id = read_by.user_id
                GROUP BY read_by.message_id
              ) as read_by
        ON read_by.eventcheckmessage_id = ecm.id
      WHERE ecm.object_id = '${object_id}';`;

const getEventCheckMessagesQuery = ({
  eventCheckId,
  clientID,
  limit,
  offset,
  sort,
}) => `Select 
      row_to_json(ecm.*) as eventcheckmessage, 
      row_to_json(ec.*) as event_check, 
      row_to_json(usr.*) as user,
      row_to_json(cby_u.*) as created_by,
      row_to_json(uby_u.*) as updated_by,
      row_to_json(dby_u.*) as deleted_by,
      COALESCE(read_by.read_bys, '[]') as user_views
      from ${TABLES.EVENT_CHECK_MESSAGE} as ecm
        JOIN ${TABLES.EVENT_CHECK} as ec 
          ON ec.id = ecm.event_check_id
        JOIN ${USER_TABLES.USER} as usr 
          ON usr.id = ecm.user_id
        Left JOIN ${USER_TABLES.USER} as cby_u 
          ON cby_u.id = ecm.created_by_id
        Left JOIN ${USER_TABLES.USER} as uby_u 
          ON uby_u.id = ecm.updated_by_id
        Left JOIN ${USER_TABLES.USER} as dby_u 
          ON dby_u.id = ecm.deleted_by_id
        LEFT JOIN 
            (SELECT read_by.message_id AS eventcheckmessage_id, array_to_json(array_agg(
                json_build_object( 
                  'id', read_by.id,
                  'user_id', read_by.user_id,
                  'user', usr,
                  'viewed_at', read_by.viewed_at
                )
              )) AS read_bys
                FROM  ${TABLES.EVENT_CHECK_MESSAGE_VIEW} as read_by
                JOIN ${USER_TABLES.USER} as usr
                  ON usr.id = read_by.user_id
                GROUP BY read_by.message_id
              ) as read_by
        ON read_by.eventcheckmessage_id = ecm.id
      WHERE NOT ec.deleted ${
        clientID ? `AND usr.client_id = ${clientID}` : ""
      } ${
  eventCheckId ? `AND ec.object_id = '${eventCheckId}'` : ""
} ORDER BY ecm.sent_at ${sort} OFFSET ${offset} LIMIT ${limit};`;

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
                   where uu.deleted = false and ee.object_id = '${event_id}'
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
