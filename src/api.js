import last from 'lodash/last'
import { buildUser, buildArtist, buildAlbum, sleep } from 'helpers'

/**
 * Default to account market
 */
const DEFAULT_MARKET = 'from_token'

/**
 * Represents an error encountered during data fetching
 */
class FetchError extends Error {
  /**
   * @param {number} status
   * @param {string} statusText
   * @param {string} [message]
   */
  constructor(status, statusText, message) {
    super(message)
    this.name = 'FetchError'
    this.status = status
    this.statusText = statusText
  }
}

/**
 * Return current user
 *
 * @param {string} token
 * @returns {Promise<User>}
 */
export async function getUser(token) {
  /** @type {SpotifyUser} */
  const userResponse = await get(apiUrl('me'), token)
  const user = buildUser(userResponse)

  return user
}

/**
 * Return current user's followed artists
 *
 * @param {string} token
 * @returns {Promise<Artist[]>}
 */
export async function getUserFollowedArtists(token) {
  /** @type {Artist[]} */
  const artists = []
  const params = new URLSearchParams({ limit: String(50), type: 'artist' })

  let next = apiUrl(`me/following?${params}`)

  while (next) {
    /** @type {{ artists: Paged<SpotifyArtist> }} */
    const response = await get(next, token)
    const nextArtists = response.artists.items.map(buildArtist)

    artists.push(...nextArtists)
    next = response.artists.next
  }

  return artists
}

/**
 * Return artist's albums
 *
 * @param {string} token
 * @param {string} artistId
 * @param {AlbumGroup[]} groups
 * @param {Market} market
 * @param {string} minDate
 * @returns {Promise<Album[]>}
 */
export async function getArtistAlbums(token, artistId, groups, market, minDate) {
  /** @type {Album[]} */
  const albums = []
  const params = new URLSearchParams({
    limit: String(50),
    include_groups: groups.join(','),
    market: market || DEFAULT_MARKET,
  })

  let next = apiUrl(`artists/${artistId}/albums?${params}`)

  while (next) {
    /** @type {Paged<SpotifyAlbum>} */
    const response = await get(next, token)
    const nextAlbums = response.items.map((album) => buildAlbum(album, artistId))

    albums.push(...nextAlbums)
    next = last(albums).releaseDate > minDate ? response.next : null
  }

  const lastGroup = last(albums).group
  const restGroups = groups.slice(groups.indexOf(lastGroup) + 1)

  if (restGroups.length > 0) {
    const restAlbums = await getArtistAlbums(token, artistId, restGroups, market, minDate)

    albums.push(...restAlbums)
  }

  return albums
}

/**
 * Return albums track IDs
 *
 * @param {string} token
 * @param {string[]} albumIds
 * @param {Market} [market]
 * @returns {Promise<string[]>}
 */
export async function getAlbumsTrackIds(token, albumIds, market) {
  /** @type {string[]} */
  const trackIds = []
  const params = new URLSearchParams({
    ids: albumIds.join(','),
    market: market || DEFAULT_MARKET,
  })

  /** @type {{ albums: Array<{ tracks: Paged<SpotifyTrack> }> }} */
  const response = await get(apiUrl(`albums?${params}`), token)

  for (const album of response.albums) {
    const albumTrackIds = album.tracks.items.map((track) => track.id)
    let next = album.tracks.next

    while (next) {
      /** @type {Paged<SpotifyTrack>} */
      const response = await get(next, token)
      const nextAlbumTrackIds = response.items.map((track) => track.id)

      albumTrackIds.push(...nextAlbumTrackIds)
      next = response.next
    }

    trackIds.push(...albumTrackIds)
  }

  return trackIds
}

/**
 * Create new playlist
 *
 * @param {string} token
 * @param {string} userId
 * @param {string} name
 * @param {string} description
 * @param {boolean} isPrivate
 * @returns {Promise<SpotifyPlaylist>}
 */
export function createPlaylist(token, userId, name, description, isPrivate) {
  return post(apiUrl(`users/${userId}/playlists`), token, {
    name,
    description,
    public: !isPrivate,
  })
}

/**
 * Add tracks to existing playlist
 *
 * @param {string} token
 * @param {string} playlistId
 * @param {string[]} trackUris
 * @returns {Promise<SpotifyPlaylistSnapshot>}
 */
export function addTracksToPlaylist(token, playlistId, trackUris) {
  return post(apiUrl(`playlists/${playlistId}/tracks`), token, { uris: trackUris })
}

/**
 * Create full API url
 *
 * @param {string} endpoint
 * @returns {string}
 */
function apiUrl(endpoint) {
  return `https://api.spotify.com/v1/${endpoint}`
}

/**
 * Fire GET request
 *
 * @param {string} endpoint
 * @param {string} token
 * @returns {Promise<any>}
 */
function get(endpoint, token) {
  return request(endpoint, token, 'GET')
}

/**
 * Fire POST request
 *
 * @param {string} endpoint
 * @param {string} token
 * @param {{ [prop: string]: any }} body
 * @returns {Promise<any>}
 */
function post(endpoint, token, body) {
  return request(
    endpoint,
    token,
    'POST',
    { Accept: 'application/json', 'Content-Type': 'application/json' },
    JSON.stringify(body)
  )
}

/**
 * Spotify API request wrapper
 *
 * @param {string} endpoint
 * @param {string} token
 * @param {string} method
 * @param {{ [prop: string]: any }} [headers]
 * @param {string} [body]
 * @returns {Promise<any>}
 */
async function request(endpoint, token, method, headers = {}, body) {
  const authHeader = { Authorization: `Bearer ${token}` }
  const response = await fetch(endpoint, { method, body, headers: { ...headers, ...authHeader } })

  if (response.ok) {
    return response.json()
  }

  // Handle 429 Too many requests
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After'))

    // Add 1 extra second because Retry-After is not accurate
    await sleep((retryAfter + 1) * 1000)

    return request(endpoint, token, method, headers, body)
  }

  if (response.status >= 400 && response.status < 500) {
    const json = await response.json()

    throw new FetchError(response.status, response.statusText, json.error.message)
  }

  throw new FetchError(response.status, response.statusText)
}
