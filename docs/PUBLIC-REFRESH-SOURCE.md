# Public refresh source

The finished public source is committed directly under `public/`. HTML pages, CSS, page JavaScript, and the versioned hero, cabin-filter, and social-card image bytes are part of the repository.

`npm test` and `npm run build` consume those checked-in files. The build does not call an image-transfer service or rewrite public pages. Booking, availability, upload, authentication, and private-dashboard implementation remain in their existing source files.
