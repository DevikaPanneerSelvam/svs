#!/usr/bin/sudo /bin/sh
# Need to define the absolute path to python on the server (auto start@server-boot)
# Also need the relative path for development (./venv/bin/python)
""":"
bold=$(tput bold)
normal=$(tput sgr0)
if [ -f /srv/www/htdocs/svs3/venv/bin/python ]; then
    echo "\033[4m\033[1mserver python venv:\033[0m"
    exec /srv/www/htdocs/svs3/venv/bin/python "$0" "$@"
elif [ -f ./venv/bin/python ]; then
    echo "\033[4m\033[1mlocal python venv:\033[0m"
    exec ./venv/bin/python "$0" "$@"
else
    echo "\033[4m\033[1mWorking python environment not found.\nCheck paths in shebang line in 'main.py'\033[0m"
    exit 0
fi
":"""

import sys

import os
import random
import re
import smtplib
import sqlite3
import string
import subprocess
import tempfile
from email.mime.text import MIMEText
from functools import partial

import io
from jinja2 import Undefined

import markdown
import translitcodec  # provides 'translit/*' codecs for str.encode
import codecs
from flask import Flask, g, request, session, abort, jsonify, send_file

import hashlib 
import binascii

from password_strength import PasswordPolicy

# for database daily backup in zipped file
from datetime import datetime
import zipfile
import time
from apscheduler.schedulers.background import BackgroundScheduler

policy = PasswordPolicy.from_names(
    length=8,  # min length: 8
    uppercase=1,  # need min. 2 uppercase letters
    numbers=1,  # need min. 2 digits
    special=1,  # need min. 2 special characters
    #nonletters=2,  # need min. 2 non-letter characters (digits, specials, anything)
)
 

app = Flask(__name__)
app.config.from_object('settings')


EMAIL_SUBJECT = 'Your Spicy VoltSim login data'
EMAIL_TEMPLATE = '''Welcome to Spicy VoltSim!

Your username: %(name)s
Your password: %(passwd)s

You can now log in at <%(url)s>.

Please change your password on first log-in.
'''


if not app.debug:
    # Log exceptions so they end up in the service log
    import sys
    import logging
    log_handler = logging.StreamHandler(sys.stdout)
    log_handler.setLevel(logging.WARNING)
    app.logger.addHandler(log_handler)


get = partial(app.route, methods=['GET'])
post = partial(app.route, methods=['POST'])
put = partial(app.route, methods=['PUT'])
delete = partial(app.route, methods=['DELETE'])


def connect_db():
    """Open a new database connection."""
    db = sqlite3.connect(app.config['DBNAME'])
    db.row_factory = sqlite3.Row
    return db


def get_db():
    """Get the current database connection."""
    if not hasattr(g, 'db'):
        g.db = connect_db()
    return g.db


@app.teardown_appcontext
def close_db(error):
    """Close the current datbase connection."""
    if hasattr(g, 'db'):
        g.db.close()


def slugify(s):
    """Convert a title to a lowercase list of '-' separated words in ASCII."""
    #s=codecs.encode(s.strip(), 'translit/one').encode('ascii').lower()
    s = s.strip().lower()
    return re.sub(r'[^a-z0-9]+', '-', str(s)).strip('-')

@get('/')
def home():
    return send_file('./static/home.html')
    #return send_file('./static/index.html')

@get('/index')
def index():
    return send_file('./static/index.html')

@get('/news')
def news():
    return send_file('./static/news.html')

@get('/tutorials')
def tutorials():
    return send_file('./static/tutorials.html')

@get('/userid')
def get_current_userid():
    return jsonify({'user_id': session.get('user_id')})

@get('/favicon.ico')
def favicon():
    return send_file('./static/favicon.ico')

@post('/login')
def login():
    db = get_db()
    row = db.execute('''
        select * from users where name = ?
    ''', (request.form['username'].lower(), )).fetchone()

    user_pass = request.form['password']
    c = db.cursor()

    if row :
        if row['is_public'] == 1 and user_pass == "":
            user = row['name']
            c.execute("update users set last_seen = datetime('now','localtime') where name = ? ", (user,))
            session['user'] = row['name']
            session['user_id'] = row['id'] 
            session['public_acc'] = True
            db.commit()
            return '<script>window.parent.login_public("%s");</script>' % row['name']
        elif row and verify_password(row['passwd'],user_pass):
            user = row['name']
            c.execute("update users set last_seen = datetime('now','localtime') where name = ? ", (user,))
            session['user'] = row['name']
            session['user_id'] = row['id'] 
            session['public_acc'] = False
            db.commit()
            return '<script>window.parent.login("%s");</script>' % row['name']
        else:
            return '<script>window.parent.loginfailure();</script>'
    else:
            return '<script>window.parent.loginfailure();</script>'

@post('/logout')
def logout():
    session.pop('user')
    session.pop('user_id') 
    return '<script>window.parent.logout();</script>'


@get('/user')
def get_current_user():
    return jsonify({'user': session.get('user'), "public_acc" : session.get('public_acc')})

@get('/ispublic')
def ispublic():
    db = get_db()
    rows = db.execute('''select is_public from users where name = ?''', (session['user'], )).fetchone()

    return str(rows['is_public'])
    #return jsonify({'is_public': rows})

@get('/demos')
def get_demos():
    db = get_db()

    # List user "demos"s public circuits
    rows = db.execute('''
        select c.id, c.title, c.slug, c.is_public,
            substr(c.description, 1, 100) as excerpt, u.name as owner, c.main_folder, c.sub_folder
        from circuits c join users u on c.user_id = u.id
        where u.name = ? and c.is_public = ?
        order by c.main_folder, c.sub_folder
        ''', ('demos', True)).fetchall()
        #order by c.title asc
    #''', ('demos', True)).fetchall()

    return jsonify({'entries': list(map(dict, rows))})

@get('/circuits')
def list_circuits():
    db = get_db()
    if not session.get('user'):
        return jsonify({'entries': []});

    # List the user's own circuits
    rows = db.execute('''
        select c.id, c.title, c.slug, c.is_public,
            substr(c.description, 1, 100) as excerpt, u.name as owner, c.main_folder, c.sub_folder
        from circuits c join users u on c.user_id = u.id
        where u.name = ?
         order by c.main_folder,c.sub_folder
    ''', (session['user'],)).fetchall()
       # order by c.title asc
    #''', (session['user'],)).fetchall()

    return jsonify({'entries': list(map(dict, rows))})


@post('/circuits')
def add_circuit():
    if not session.get('user'):
        abort(403)
    db = get_db()
    data = request.json
    netlist = data['netlist']
    title = data['title']
    description = data['description']
    is_public = data['is_public']

    user_id = db.execute('''
        select id from users where name = ?
    ''', (session['user'],)).fetchone()[0]

    # Check for existing title
    row = db.execute('select 1 from circuits where user_id = ? and title = ?',
            (user_id, title)).fetchone()
    if row:
        return jsonify({'error': 'Title must be unique'}), 409

    # Generate a unique slug by appending a number if necessary
    print(title)
    slug = slugify(title)
    while db.execute('select 1 from circuits where user_id = ? and slug = ?',
            (user_id, slug)).fetchone():
        if '_' in slug:
            slug, suffix = slug.split('_')
        else:
            slug, suffix = slug, '0'
        slug = '%s_%d' % (slug, int(suffix) + 1)

    c = db.cursor()
    c.execute('''
        insert into circuits (user_id, title, slug, netlist, description, is_public)
        values (?, ?, ?, ?, ?, ?)
    ''', (user_id, title, slug, netlist, description, is_public))
    db.commit()
    circuit_id = c.lastrowid

    return jsonify({'id': circuit_id})


@get('/circuits/<int:id>')
def get_circuit(id):
    db = get_db()
    if not session.get('user'):
        # Only allow access to public circuits
        row = db.execute('''
            select c.*, u.name as owner
            from circuits c join users u on c.user_id = u.id
            where c.id = ? and c.is_public = ?
        ''', (id, 1)).fetchone() 
    else:
        # Allow access a to private circuit if it belongs to the user
        row = db.execute('''
            select c.*, u.name as owner
            from circuits c join users u on c.user_id = u.id
            where c.id = ? and (c.is_public = ? or u.name = ?)
        ''', (id, True, session['user'])).fetchone()

    if row:
        data = dict(row)
        data['description_html'] = markdown.markdown(data['description'] or '',
                safe_mode='escape', output_format='html5')
    else:
        data = {}

    return jsonify(data)


@put('/circuits/<int:id>')
def update_circuit(id):
    if not session.get('user'):
        abort(403)
    db = get_db()
    data = request.json
    user_id = db.execute('''
        select id from users where name = ?
    ''', (session['user'],)).fetchone()[0]
    c = db.cursor()
    c.execute('''
        update circuits set title = ?, slug = ?, netlist = ?, description = ?,
            is_public = ?
        where id = ? and user_id = ?
    ''', (data['title'], slugify(data['title']), data['netlist'],
          data['description'], bool(data['is_public']), id, user_id))
    db.commit()
    if not c.rowcount:
        abort(400)
    return 'ok'


@delete('/circuits/<int:id>')
def delete_circuit(id):
    if not session.get('user'):
        abort(403)
    db = get_db()
    user_id = db.execute('''
        select id from users where name = ?
    ''', (session['user'],)).fetchone()[0]
    c = db.cursor()
    c.execute('''
        delete from circuits
        where id = ? and user_id = ?
    ''', (id, user_id))
    # TODO check number of rows affected
    db.commit()
    if not c.rowcount:
        abort(400)
    return 'ok'


@post('/spice')
def simulate_netlist():
    tmpdir  = tempfile.mkdtemp(prefix='svs_')
    netlist = os.path.join(tmpdir, 'netlist.txt')
    output  = os.path.join(tmpdir, 'output.txt')
    log     = os.path.join(tmpdir, 'log.txt')
    errors  = os.path.join(tmpdir, 'errors.txt')

    with io.open(netlist, 'wb') as file:
        # FIXME: parse netlist and filter out .include, .lib etc. statements, or run inside a chroot
        file.write(request.data)
    with open(log, 'wb') as stdout, open(errors, 'wb') as stderr:
        rv = subprocess.call(
            [app.config['SPICE_BIN'], '-r', output, '-b', netlist],
            env={'SPICE_ASCIIRAWFILE': '1'},
            stdout=stdout,
            stderr=stderr,
        )
    return send_file(open(output, 'rb'), mimetype='text/plain')

@post('/getfolder')
def getfolder():
    db = get_db()
    c = db.cursor()
    rows = db.execute('select c.main_folder, c.sub_folder from circuits c where c.id = ?', (request.json.get('ckt_id', ''),)).fetchone()
    return jsonify({'folderdetails': dict(rows)})

@post('/editfolder')
def editfolder():
    level = request.json.get('level', '')
    oldmainfolder = request.json.get('old_main_folder_name', '')
    db = get_db()
    c = db.cursor()

    if level == "main":
        newmainname = request.json.get('new_main_folder_name', '')
        c.execute('''
        update circuits set main_folder = ?
        where user_id = ? and main_folder = ?
        ''', (newmainname, session.get('user_id'), oldmainfolder))
    else :
        newsubname = request.json.get('new_sub_folder_name', '')
        oldsubfolder = request.json.get('old_sub_folder_name', '')
        c.execute('''
        update circuits set sub_folder = ?
        where user_id = ? and main_folder = ? and sub_folder = ?
        ''', (newsubname, session.get('user_id'),oldmainfolder, oldsubfolder))

    db.commit()

    return 'ok'

@post('/configurefolder')
def configurefolder():
    mainname = request.json.get('main_folder_name', '')
    subname = request.json.get('sub_folder_name', '')
    cktid = request.json.get('cktid', '').strip()
    db = get_db()

    c = db.cursor()
    c.execute('''
        update circuits set main_folder = ?, sub_folder = ?
        where id = ?
    ''', (mainname, subname, cktid))
    db.commit()

    return 'ok'

@post('/signup')
def create_account():
    name = request.json.get('name', '').strip().lower()
    email = request.json.get('email', '').strip()
    # is_public = request.json['is_public']
    is_public = request.json.get('is_public','')

    if not name:
        return jsonify({'name': "Name can not be empty"}), 400

    db = get_db()
    row = db.execute('select 1 from users where name = ?', (name,)).fetchone()
    row1 = db.execute('select 1 from users where email = ?', (email,)).fetchone()
    
    if row:
        return jsonify({'name': "Username already exists"}), 400

    if row1:
        return jsonify({'email': "Email already exists"}), 400

    if not re.match(r'^[^@]+@[^@]+$', email):
        return jsonify({'email': "Not a valid email address"}), 400

    regex = re.compile(r'([A-Za-z0-9]+[.-_])*[A-Za-z0-9]+@[A-Za-z0-9-]+(\.[A-Z|a-z]{2,})+')

    if not re.fullmatch(regex, email):
        return jsonify({'email': "Not a valid email address"}), 400

    passwd = ''.join([random.choice(string.digits) for _ in range(6)])

    hashedpasswd = hash_password(passwd) 

    text = EMAIL_TEMPLATE % {
        'name': name,
        'passwd': passwd,
        'url': app.config['EMAIL_URL'],
    }
    msg = MIMEText(text)
    msg['Subject'] = EMAIL_SUBJECT
    msg['From'] = app.config['EMAIL_FROM']
    msg['To'] = email

     # check here if DB insertion is successful
    try:
        db.execute('insert into users (name, email, passwd, is_public) values (?, ?, ?, ?)',
        (name, email, hashedpasswd, is_public))
        db.commit()

    except Exception as x:
        print("Database insertion failed, Mail won't be sent: ", str(x)) #Log exeption
        return jsonify({'fatal': "Database Error!. Please sign up again."}), 500


    # Don't send email in debug mode
    if not app.debug:
        try:
            if app.config['SMTP_SSL']:
                smtp = smtplib.SMTP_SSL(app.config['SMTP_HOST'])
            else:
                smtp = smtplib.SMTP(app.config['SMTP_HOST'])
            try:
                if app.config['SMTP_TLS']:
                    smtp.starttls()
                smtp.login(app.config['SMTP_USER'], app.config['SMTP_PASS'])
                smtp.sendmail(msg['From'], [msg['To']], msg.as_string())

            finally:
                smtp.close()
        except Exception as e:
            print("Error sending email:", str(e))  # Log exception
            db.execute('delete from users order by created_at desc limit 1') # delete the new user if sending mail fails.
            db.commit()
            return jsonify({'fatal': "There was an error sending the activation email. Please try again later."}), 500

    print("*** EMAIL SENT:")
    print(msg.as_string())
    print("***")

    return 'ok'


@post('/forgotpass')
def resend_pass():
    email = request.json.get('email', '').strip()

    if not email:
        return jsonify({'email': "Email can not be empty."}), 400
    
    if not re.match(r'^[^@]+@[^@]+$', email):
        return jsonify({'email': "Not a valid email address"}), 400

    db = get_db()
    row = db.execute('select 1 from users where email = ?', (email,)).fetchone()
    
    if not row:
        return jsonify({'email': "No user registered with such email. Please try again."}), 400

    passwd = ''.join([random.choice(string.digits) for _ in range(6)])
    name = db.execute('select name from users where email = ?', (email,)).fetchone()[0]

    FORGOT_EMAIL_TEMPLATE_BEGIN = '''
        Hello %(name)s, 

        Welcome to Spicy VoltSim! Your password has been reset and the new password is given below.

        Your username: %(name)s
        Your password: %(passwd)s

        You can now log in at <%(url)s>.

        Please change your password after signing in. 
        '''
    
    FORGOT_EMAIL_SUBJECT = 'Forgot password - Your SpicyVOLT Sim Login Data'

   
    text = FORGOT_EMAIL_TEMPLATE_BEGIN % {
        'name': name,
        'passwd': passwd,
        'url': app.config['EMAIL_URL'],
        } 
    
    msg = MIMEText(text)
    msg['Subject'] = FORGOT_EMAIL_SUBJECT
    msg['From'] = app.config['EMAIL_FROM']
    msg['To'] = email

     # check here if DB insertion is successful
     #inserting hashed password
    try:
        db.execute('''update users set passwd=? where name=?''',(hash_password(passwd),str(name)))
        db.commit()

    except Exception as x:
        print("Database insertion failed, Mail won't be sent: ", str(x)) #Log exeption
        return jsonify({'fatal': "Database Error!. Please try again."}), 500


    # Don't send email in debug mode
    if not app.debug:
        try:
            if app.config['SMTP_SSL']:
                smtp = smtplib.SMTP_SSL(app.config['SMTP_HOST'])
            else:
                smtp = smtplib.SMTP(app.config['SMTP_HOST'])
            try:
                if app.config['SMTP_TLS']:
                    smtp.starttls()
                smtp.login(app.config['SMTP_USER'], app.config['SMTP_PASS'])
                smtp.sendmail(msg['From'], [msg['To']], msg.as_string())

            finally:
                smtp.close()
        except Exception as e:
            print("Error sending email:", str(e))  # Log exception
            return jsonify({'fatal': "There was an error sending the email. Please try again later."}), 500

    print("*** EMAIL SENT:")
    print(msg.as_string())
    print("***")

    return 'ok'

@post('/accPublic')
def accPublic():
    is_public = request.json['is_public']
    pwd = request.json['pwd']
    name = session['user']
    db = get_db()
    row1 = db.execute('''
        select * from users where name = ?
    ''', (str(name),)).fetchone()
    stored_password = row1['passwd']
    if not verify_password(stored_password, pwd):
        return jsonify({'public_password': "Password not correct. Please try again."}), 400

    db.execute('''update users set is_public=? where name=?''',(is_public,str(name)))
    db.commit()
    return 'ok'

@post('/delAccount')
def delAccount():
    pwd = request.json.get('pwd', '')
    name = session['user']
    db = get_db()
    row1 = db.execute('''
        select * from users where name = ?
    ''', (str(name),)).fetchone()
    stored_password = row1['passwd']
    if not verify_password(stored_password, pwd):
        return jsonify({'delacc_password': "Password not correct. Please try again."}), 400

    c = db.cursor()

    db.execute('''
        delete from users
        where id = ? and name = ?
    ''', (row1['id'], name))

    row2 = db.execute('''
        select * from circuits where user_id = ?
    ''', (str(row1['id']),))

    if row2 :
        db.execute('''delete from circuits where user_id = ?''', (str(row1['id']),))

    db.commit()
    return 'ok'

@post('/updateUserName')
def updateUserName():
    newusername = request.json.get('newUserName', '')
    pwd = request.json.get('pwd', '')
    name = session['user']
    db = get_db()
    row1 = db.execute('''
        select * from users where name = ?
    ''', (str(newusername),)).fetchone()
    if row1 :
        return jsonify({'name': "Username already exists. Please try a different one."}), 400

    row1 = db.execute('''
        select * from users where name = ?
    ''', (str(name),)).fetchone()
    stored_password = row1['passwd']
    if not verify_password(stored_password, pwd):
        return jsonify({'name_password': "Password not correct. Please try again."}), 400

    c = db.cursor()
    db.execute('''update users set name=? where name=?''',(newusername,str(name)))
    db.commit()
    session['user'] = newusername
    return 'ok'

@post('/changeEmail')
def changeEmail():
    newemail = request.json.get('email', '')
    pwd = request.json.get('pwd', '')
    name = session['user']
    regex = re.compile(r'([A-Za-z0-9]+[.-_])*[A-Za-z0-9]+@[A-Za-z0-9-]+(\.[A-Z|a-z]{2,})+')

    if not re.fullmatch(regex, newemail):
        return jsonify({'email': "Not a valid email address"}), 400

    db = get_db()
    row1 = db.execute('''
        select * from users where name = ?
    ''', (str(name),)).fetchone()
    stored_password = row1['passwd']
    if not verify_password(stored_password, pwd):
        return jsonify({'email_password': "Password not correct. Please try again."}), 400

    c = db.cursor()
    db.execute('''update users set email=? where name=?''',(newemail,str(name)))
    db.commit()
    return 'ok'

@post('/changepass')
def change_pass():
    old_password = request.json.get('oldpass', '').strip()
    new_password = request.json.get('newpass', '').strip()
    new_password_confirm = request.json.get('newpassconfirm', '').strip()

    name = session['user']

    db = get_db()
    row1 = db.execute('''
        select * from users where name = ?
    ''', (str(name),)).fetchone()
    stored_password = row1['passwd']

    if not old_password:
        return jsonify({'old_password': "Current password can not be empty."}), 400

    if not new_password:
        return jsonify({'new_password': "New Password can not be empty."}), 400

    if not new_password_confirm:
        return jsonify({'new_password_confirm': "Please confirm new password."}), 400

    if not verify_password(stored_password, old_password):
        return jsonify({'old_password': "Current password not correct. Please try again."}), 400
    
    p = policy.test(new_password)
    
    if(p):
        print("Error : The password does not contain - " + str(p))
        return jsonify({'new_password': "Password must have atleast 8 characters, atleast 1 Uppercase, 1 Lowercase, 1 Number and 1 Symbol."}), 400

    if new_password != new_password_confirm:
        return jsonify({'new_password_confirm': "Confirmed password is not the same as new password. Please verify."}), 400

    hashedpassword = hash_password(new_password)

     # check here if DB insertion is successful
    try:
        db.execute('''update users set passwd=? where name=?''',(hashedpassword,str(name)))
        db.commit()

    except Exception as x:
        print("Database error", str(x)) #Log exeption
        return jsonify({'fatal': "Database Error!. Please try again."}), 500


    return 'ok'


def hash_password(password):
    """Hash a password for storing."""
    salt = hashlib.sha256(os.urandom(60)).hexdigest().encode('ascii')
    pwdhash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), 
                                salt, 100000)
    pwdhash = binascii.hexlify(pwdhash)
    return (salt + pwdhash).decode('ascii')
 
def verify_password(stored_password, provided_password):
    """Verify a stored password against one provided by user"""
    salt = stored_password[:64]
    stored_password = stored_password[64:]
    pwdhash = hashlib.pbkdf2_hmac('sha512', 
                                  provided_password.encode('utf-8'), 
                                  salt.encode('ascii'), 
                                  100000)
    pwdhash = binascii.hexlify(pwdhash).decode('ascii')
    return pwdhash == stored_password

def DBbackUp():
    now = datetime.now()
    if app.config['RUN_MODE'] == 'local':
        locfile = "./svs.sqlite"
        loczip = now.strftime("./BKP/%y%m%d_%H%M%S_svs.sqlite.bkp.zip")
    else:
        locfile = "/srv/www/htdocs/svs3/svs.sqlite"
        loczip = now.strftime("/root/SVS3_DB_BKP/%y%m%d_%H%M%S_svs.sqlite.bkp.zip")

    zip = zipfile.ZipFile (loczip, "w",compression=zipfile.ZIP_DEFLATED)
    zip.write (locfile)
    zip.close()

def updateSSL():    # NOT working automatically...servers needs to be down, or update forced and server restarted...
    os.system("systemctl stop apache2.service && certbot renew --force-renewal && reboot")
    time.sleep(60)
    os.system("reboot")         # in case the previous full command failed in the first two steps


if __name__ == '__main__':
    print(sys.version)
    # scheduled databse backup
    scheduler = BackgroundScheduler(timezone="Europe/Berlin")
    scheduler.add_job(DBbackUp, 'cron', hour=3, minute=0, second=0)                 # save DB into root directory   1 / day
    scheduler.add_job(updateSSL, 'cron', day=1, hour=3, minute=1, second=0)         # update SSL and reboot         1 / month
    scheduler.start()
    # start server
    if app.config['RUN_MODE'] == 'local':
        print("\033[4m\033[1mlocal webserver:\033[0m")
        app.run(host='localhost', port=8000)
    else:
        ssl_ctxt=(
        '/etc/letsencrypt/live/svs3.imtek.uni-freiburg.de/fullchain.pem',
        '/etc/letsencrypt/live/svs3.imtek.uni-freiburg.de/privkey.pem')
        app.run(host='svs3.imtek.uni-freiburg.de',debug=False, port=443, ssl_context=ssl_ctxt)

