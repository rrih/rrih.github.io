import { constants, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

// Publish independently built directories. Neither product imports the other.
const [profile = 'dist', application = 'atlas/dist', compatibility = 'atlas/hosting', output = 'site-dist'] =
  process.argv.slice(2)
rmSync(output, { recursive: true, force: true })
mkdirSync(output)
cpSync(profile, output, { recursive: true, mode: constants.COPYFILE_FICLONE })
cpSync(application, `${output}/atlas`, { recursive: true, mode: constants.COPYFILE_FICLONE })
cpSync(compatibility, output, { recursive: true, mode: constants.COPYFILE_FICLONE })
// robots.txt and ads.txt are origin-wide hosting protocols, not profile dependencies.
writeFileSync(
  `${output}/robots.txt`,
  `${readFileSync(`${profile}/robots.txt`, 'utf8')}Sitemap: https://rrih.github.io/atlas/sitemap.xml\n`,
)
console.log(`Composed independently built sites into ${output}`)
