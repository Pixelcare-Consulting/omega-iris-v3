export type SapCredentials = {
  baseUrl: string
  companyDb: string
  userName: string
  password: string
}

//* whole cookie strings, e.g. 'B1SESSION=abc', routeid only comes behind the sap load balancer
export type SapAuthCookies = {
  b1session: string
  routeid?: string
}

export type SapResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string; message: string }
