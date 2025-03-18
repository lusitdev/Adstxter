const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const postcss = require('gulp-postcss');
const autoprefixerPlugin = require('autoprefixer');
const zip = require('gulp-zip').default;
const terser = require('gulp-terser');
const htmlmin = require('gulp-htmlmin');
const flatten = require('gulp-flatten');

function compileSass(dest) {
  const out = dest === 'dev' ? 'nested' : 'compressed';
  return gulp.src('./src/chrome/scss/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({ outputStyle: out }).on('error', sass.logError))
    .pipe(postcss([autoprefixerPlugin()]))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(`./build/${dest}/css`));
}

function buildDevWatch() {
  const dist = './build/dev';
  const images = './src/**/*.{png,jpg,jpeg,gif,svg}';
  const fonts = './src/**/fonts/**/*.{woff,woff2,txt}';
  const code = './src/**/*.{js,json,html}';

  const pipe = (glob, destPath = dist, opt = null) => gulp.src(glob, opt)
    .pipe(flatten())
    .pipe(gulp.dest(destPath));

  const watch = (glob, fn) => {
    gulp.watch(glob, { ignoreInitial: false }, fn);
  }

  watch('./src/chrome/scss/*.scss', () => compileSass('dev'));
  watch(code, () => pipe(code));
  watch(images, () => pipe(images, `${dist}/img`, { encoding: false }));
  watch(fonts, () => pipe(fonts, `${dist}/font`, { encoding: false }));
}

function buildDist() {
  const src = './src';
  const dist = './build/dist';
  
  const process = (glob, transform, destPath = dist, opt = null) => {
    let stream = gulp.src(`${src}/${glob}`, opt);
    if (transform) {
      stream = stream.pipe(transform);
    }
    return stream
      .pipe(flatten())
      .pipe(gulp.dest(destPath));
  };
  
  return Promise.all([
    compileSass('dist'),
    process('**/*.js', terser({
      compress: {
        ecma: 2020,
        passes: 2,
        drop_console: true, // Keep console for debugging or set to true for production
        // unsafe: true,
        // unsafe_methods: true
      },
      mangle: {
        properties: false // Don't rename properties as Chrome APIs use them
      },
      format: {
        comments: false,
        ecma: 2020,
        ascii_only: true
      }
    })),
    process('**/*.html', htmlmin({ collapseWhitespace: true })),
    process('**/*.{png,jpg,jpeg,gif,svg}', null, `${dist}/img`, { encoding: false }),
    process('**/fonts/**/*.{woff,woff2,txt}', null, `${dist}/font`, { encoding: false }),
    process('**/*.json')
  ]);
}

function packDist() {
  return gulp.src('./build/dist/**/*')
    .pipe(zip('adstxter.zip'))
    .pipe(gulp.dest('./release'));
}

exports.buildDevWatch = buildDevWatch;
exports.buildDist = buildDist;
exports.packDist = packDist;