var sqlite3 = require('sqlite3')
var express = require('express')
var gzip = require('connect-gzip')
var fs = require('fs')
var ansi_color = require('ansi-color').set

var app = express()
var frontend_dir = 'public'

function openDB(){
	return new sqlite3.Database('main.db', sqlite3.OPEN_READONLY)
}
//backend filter functions
function filterMessages(filter, limit, callback){
	var db = openDB()
	db.all(
		'select *, (select displayname from Conversations where id = convo_id) convo_displayname '+
		'from Messages where body_xml like ? order by id desc limit ?',
		['%'+filter+'%', parseInt(limit)], callback)
}

function filterConversations(filter, limit, callback){
	var db = openDB()
	db.all('select * from Conversations where displayname like ? limit ?',
		['%'+filter+'%', parseInt(limit)], callback)
}

function recentlyUsedConversations(days, callback){
	var db = openDB()
	db.all(
		"select convo_id, count(convo_id) count, (select displayname from Conversations where id = convo_id) displayname "+
		"from Messages "+
		"where timestamp >= strftime('%s','now') - 86400 * ? "+
		"group by convo_id",
		[parseInt(days)], callback)
}

//some tests for filtering functions
filterMessages('hi', 10, function(err, rows){
	console.log('\nLast 10 Messages containing "hi":')
	for (var i in rows){
		var row = rows[i]
		console.log(row.id, row.convo_id, row.from_dispname, row.convo_displayname,
			new Date(row.timestamp*1000), row.body_xml)
	}
})

filterConversations('jo', 10, function(err, rows){
	console.log('\nLast 10 Conversations where name containing "jo":')
	for (var i in rows){
		var row = rows[i]
		console.log(row.id, row.displayname)
	}
})

recentlyUsedConversations(10, function(err, rows){
	console.log('\nConversations with messages in the past 10 days:')
	for (var i in rows){
		var row = rows[i]
		console.log(row.convo_id, row.count, row.displayname)
	}
})





//set up logging
app.configure(function() {
	function pad2(i){ return (i < 10) ? '0' + i : i }
	express.logger.token('short-date', function(req, res){
		var d = new Date()
		return pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) + ' ' + d.toTimeString().substr(0, 8)
	})
	express.logger.token('color-status', function(req, res){
		var s = res.statusCode
		var color = 'green'
		if (s >= 500) color = 'red'
		else if (s >= 400) color = 'yellow'
		else if (s >= 300) color = 'cyan'
		return ansi_color(s, color)
	})
	app.use(express.logger({ format: ansi_color('[:short-date] (:remote-addr)', 'white')+' :method :url - HTTP :color-status - :response-time msec' }))
	app.use(express.bodyParser())
	app.use(express.methodOverride())
})
//set up static file serving
app.configure('development', function() {
	app.use(app.router)
	app.use(gzip.gzip())
	app.use(express.static(frontend_dir))
})
//published API
app.get('/messages/:filter?/:limit?', function(req, res){
	filterMessages(req.params.filter || '', req.params.limit || 10, function(err, rows){
		res.send(rows)
	})
})
app.post('/messages', function(req, res){
	var params = req.body || {}
	filterMessages(params.filter || '', params.limit || 10, function(err, rows){
		res.send(rows)
	})
})
app.get('/conversations/:filter?/:limit?', function(req, res){
	filterConversations(req.params.filter || '', req.params.limit || 10, function(err, rows){
		res.send(rows)
	})
})
app.post('/conversations', function(req, res){
	var params = req.body || {}
	filterConversations(params.filter || '', params.limit || 10, function(err, rows){
		res.send(rows)
	})
})
app.post('/recently_used_conversations', function(req, res){
	var params = req.body || {}
	console.log('recently_used_conversations, days:', params.days)
	recentlyUsedConversations(params.days || 10, function(err, rows){
		res.send(rows)
	})
})

port = process.env.PORT || 8001
app.listen(port)
console.log("\n\n\n\nExpress server listening on port %d in %s mode\n", port, app.settings.env)
