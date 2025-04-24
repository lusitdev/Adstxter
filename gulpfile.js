const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps');
const postcss = require('gulp-postcss');
const autoprefixerPlugin = require('autoprefixer');
const terser = require('gulp-terser');
const htmlmin = require('gulp-htmlmin');
const flatten = require('gulp-flatten');
const rename = require('gulp-rename');
const nodePath = require('path');
const fs = require('fs');
const archiver = require('archiver');

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

  const pipe = (glob, destPath = dist, opt = null) => {
    if (opt && opt.fonts) {
      return gulp.src(glob, opt)
        .pipe(rename((path) => {
          const parts = path.dirname.split(nodePath.sep);
          const fontsIndex = parts.indexOf('fonts');
          if (fontsIndex !== -1) {
            // Drop everything up to “fonts,” leaving the next subfolder
            path.dirname = parts.slice(fontsIndex + 1).join(nodePath.sep);
          }
        }))
        .pipe(gulp.dest(destPath));
  }
    return gulp.src(glob, opt)
      .pipe(flatten())
      .pipe(gulp.dest(destPath));
  };

  const watch = (glob, fn) => {
    gulp.watch(glob, { ignoreInitial: false }, fn);
  }

  watch('./src/chrome/scss/*.scss', () => compileSass('dev'));
  watch(code, () => pipe(code));
  watch(images, () => pipe(images, `${dist}/img`, { encoding: false }));
  watch(fonts, () => pipe(fonts, `${dist}/font`, { encoding: false, fonts: true }));
}

function buildDist() {
  const src = './src';
  const dist = './build/dist';
  
  const process = (glob, transform, destPath = dist, opt = null) => {
    let stream = gulp.src(`${src}/${glob}`, opt);
    if (transform) {
      stream = stream.pipe(transform);
    }
    if (opt && opt.fonts) {
      return stream
        .pipe(rename((path) => {
          const parts = path.dirname.split(nodePath.sep);
          const fontsIndex = parts.indexOf('fonts');
          if (fontsIndex !== -1) {
            // Drop everything up to “fonts,” leaving the next subfolder
            path.dirname = parts.slice(fontsIndex + 1).join(nodePath.sep);
          }
        }))
        .pipe(gulp.dest(destPath));
    }
    stream = stream.pipe(flatten());
    return stream.pipe(gulp.dest(destPath));  
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
    process('**/fonts/**/*.{woff,woff2,txt}', null, `${dist}/font`, { encoding: false, fonts: true }),
    process('**/*.json')
  ]);
}

function packDist() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream('./release/adstxter.zip');
    const archive = archiver('zip', {
      zlib: { level: 5 }  // lowest for fastest compression
    });
    
    output.on('close', resolve);
    archive.on('error', reject);
    
    archive.pipe(output);
    archive.directory('./build/dist/', false);
    archive.finalize();
  });
}

exports.buildDevWatch = buildDevWatch;
exports.buildDist = buildDist;
exports.packDist = packDist;