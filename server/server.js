const express = require('express');
const ejs = require('ejs');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const db = require("./db");
const conn = db.conn;
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views")); // views 디렉터리 경로 수정
app.use(bodyParser.urlencoded({ extended: true }));

// 세션 설정 (라우트보다 위에 있어야 함)
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// 세션 정보를 모든 템플릿에서 접근 가능하도록 설정
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// 메인 페이지 (게시글 목록 + 페이지네이션)
app.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    conn.query("SELECT COUNT(*) AS count FROM newtable", (err, countResult) => {
        if (err) return res.send("Error fetching data.");

        const totalPosts = countResult[0].count;
        const totalPages = Math.ceil(Number(totalPosts) / limit);

        conn.query("SELECT * FROM newtable ORDER BY created_at DESC LIMIT ? OFFSET ?", [limit, offset], (err, posts) => {
            if (err) return res.send("Error fetching data.");

            conn.query("SELECT * FROM newtable", (err, allPosts) => { // 모든 게시글 가져오기
                if (err) return res.send("Error fetching all posts.");

                res.render('main', {
                    posts: posts,
                    allPosts: allPosts, // 모든 게시글 전달
                    currentPage: page,
                    totalPages: totalPages,
                    session: req.session, // 세션 데이터 전달
                });
            });
        });
    });
});

// 개별 게시글 조회
app.get('/post/:id', (req, res) => {
    conn.query("SELECT * FROM newtable WHERE id = ?", [req.params.id], (err, result) => {
        if (err || result.length === 0) return res.send("Post not found.");
        res.render('post', { post: result[0] });
    });
});

// 게시글 추가 (로그인 필요)
app.post('/add', isAuthenticated, (req, res) => {
    const { title, content } = req.body;

    conn.query("INSERT INTO newtable (title, content) VALUES (?, ?)", [title, content], (err) => {
        if (err) return res.send("Error adding post.");
        res.redirect('/');
    });
});

// 게시글 수정
app.post('/edit/:id', isAuthenticated, (req, res) => {
    const { title, content } = req.body;
    const postId = req.params.id;

    conn.query("UPDATE newtable SET title = ?, content = ? WHERE id = ?", [title, content, postId], (err) => {
        if (err) return res.send("Error updating post.");
        res.redirect('/');
    });
});

// 게시글 삭제
app.post('/delete/:id', isAuthenticated, (req, res) => {
    const postId = req.params.id;

    conn.query("DELETE FROM newtable WHERE id = ?", [postId], (err) => {
        if (err) return res.send("Error deleting post.");
        res.redirect('/');
    });
});

// 검색 기능 (페이지네이션 적용)
app.get('/search', (req, res) => {
    const searchQuery = req.query.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;
    
    if (!searchQuery) return res.redirect('/');

    conn.query("SELECT COUNT(*) AS count FROM newtable WHERE title LIKE ?", [`%${searchQuery}%`], (err, countResult) => {
        if (err) return res.send("Error counting search results.");

        const totalPosts = countResult[0].count;
        const totalPages = Math.ceil(totalPosts / limit);

        conn.query("SELECT * FROM newtable WHERE title LIKE ? LIMIT ? OFFSET ?", [`%${searchQuery}%`, limit, offset], (err, result) => {
            if (err) return res.send("Error searching.");

            conn.query("SELECT * FROM newtable", (err, allPosts) => { // 모든 게시글 가져오기
                if (err) return res.send("Error fetching all posts.");

                res.render('main', {
                    posts: result,
                    allPosts: allPosts, // 모든 게시글 전달
                    currentPage: page,
                    totalPages: totalPages,
                    session: req.session, // 세션 데이터 전달
                });
            });
        });
    });
});

// 회원가입 (중복 체크 추가)
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    conn.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
        if (err) return res.send("Error checking username.");
        if (results.length > 0) return res.send("Username already exists.");

        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.send("Error hashing password.");
            
            conn.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], (err) => {
                if (err) return res.send("Error registering user.");
                res.redirect('/login');
            });
        });
    });
});

app.get('/register', (req, res) => res.render('register'));

// 로그인
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    conn.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
        if (err || results.length === 0) return res.send("User not found.");

        bcrypt.compare(password, results[0].password, (err, isMatch) => {
            if (err || !isMatch) return res.send("Incorrect password.");
            req.session.user = results[0]; // user_id가 포함된 사용자 정보 저장
            res.redirect('/');
        });
    });
});

app.get('/login', (req, res) => res.render('login'));

// 로그아웃
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.send("Error logging out.");
        res.redirect('/');
    });
});

app.listen(3000, () => console.log("Server is running on port 3000"));