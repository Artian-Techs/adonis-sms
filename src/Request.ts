import fetch from 'node-fetch'

export default class Request {
  #headers: Record<string, string>

  #options = {} as { method: string; headers: Record<string, string>; body: string }

  constructor(private url: string, private method = 'POST') {
    this.#options.method = this.method
  }

  public headers(headers: Record<string, string>) {
    this.#headers = { ...this.#headers, ...headers }

    return this
  }

  public header(name: string, value: string) {
    this.#headers[name] = value

    return this
  }

  public body(body: string) {
    this.#options.body = body

    return this
  }

  public async send() {
    this.#options.headers = this.#headers

    const response = await fetch(this.url, this.#options)

    return await response.json()
  }
}
