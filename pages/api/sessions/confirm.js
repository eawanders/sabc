import { Client } from '@notionhq/client'
import Mailgun from 'mailgun.js'
import formData from 'form-data'

const SESSION_STATUS_PROPERTY = process.env.NOTION_SESSION_STATUS_PROPERTY || 'Status'
const SESSION_EMAIL_SENT_PROPERTY = process.env.NOTION_SESSION_EMAIL_SENT_PROPERTY || 'Email Sent'
const SESSION_USERS_RELATION_PROPERTY = process.env.NOTION_SESSION_USERS_RELATION_PROPERTY || 'Users'
const USER_EMAIL_PROPERTY = process.env.NOTION_USER_EMAIL_PROPERTY || 'Email'
const CONFIRMED_STATUS_VALUE = process.env.NOTION_SESSION_CONFIRMED_VALUE || 'Confirmed'

let notionClient
let mailgunClient

function getEnv(name, options = {}) {
  const value = process.env[name] || options.fallback
  if (!value && !options.optional) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value || ''
}

function getNotionClient() {
  if (!notionClient) {
    const notionToken = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN
    if (!notionToken) {
      throw new Error('Missing Notion credentials. Set NOTION_API_KEY or NOTION_TOKEN.')
    }

    notionClient = new Client({ auth: notionToken })
  }

  return notionClient
}

function getMailgunClient() {
  if (!mailgunClient) {
    const apiKey = getEnv('MAILGUN_API_KEY')
    const apiUrl = getEnv('MAILGUN_API_URL', { fallback: 'https://api.mailgun.net' })
    const mailgun = new Mailgun(formData)
    mailgunClient = mailgun.client({ username: 'api', key: apiKey, url: apiUrl })
  }

  return mailgunClient
}

function getSessionTitle(sessionPage) {
  const titleProperty = Object.values(sessionPage.properties || {}).find((prop) => prop?.type === 'title')
  if (!titleProperty || !Array.isArray(titleProperty.title)) {
    return ''
  }

  const [first] = titleProperty.title
  return first?.plain_text || ''
}

function extractUserEmail(property) {
  if (!property) return null

  if (property.type === 'email') {
    return property.email || null
  }

  if (property.type === 'rich_text') {
    const candidate = property.rich_text.map((entry) => entry.plain_text).find((text) => text && text.includes('@'))
    return candidate || null
  }

  if (property.type === 'people') {
    const person = property.people.find((entry) => entry.type === 'person' && entry.person?.email)
    return person?.person?.email || null
  }

  if (property.type === 'formula' && property.formula?.type === 'string') {
    const text = property.formula.string
    return text && text.includes('@') ? text : null
  }

  return null
}

async function fetchConfirmedSessions(notion, sessionsDatabaseId) {
  const response = await notion.databases.query({
    database_id: sessionsDatabaseId,
    filter: {
      and: [
        {
          property: SESSION_STATUS_PROPERTY,
          status: { equals: CONFIRMED_STATUS_VALUE },
        },
        {
          property: SESSION_EMAIL_SENT_PROPERTY,
          checkbox: { equals: false },
        },
      ],
    },
  })

  return response.results
}

function getSessionUserRelations(sessionPage) {
  const relationProperty = sessionPage.properties?.[SESSION_USERS_RELATION_PROPERTY]
  if (!relationProperty || relationProperty.type !== 'relation') {
    return []
  }

  return relationProperty.relation || []
}

async function fetchUserEmails(notion, relations) {
  if (!relations.length) return []

  const responses = await Promise.allSettled(
    relations.map((relation) => notion.pages.retrieve({ page_id: relation.id }))
  )

  const emails = new Set()

  for (const result of responses) {
    if (result.status === 'fulfilled') {
      const userPage = result.value
      const email = extractUserEmail(userPage.properties?.[USER_EMAIL_PROPERTY])
      if (email) {
        emails.add(email.toLowerCase())
      }
    } else {
      console.error('Failed to retrieve related user page', result.reason)
    }
  }

  return Array.from(emails)
}

function buildEmailContent(sessionName) {
  const subject = process.env.MAILGUN_CONFIRMATION_SUBJECT || 'Your Gym Session is Confirmed!'

  const lines = [
    'Hi there,',
    '',
    sessionName
      ? `Great news — your gym session "${sessionName}" is confirmed.`
      : 'Great news — your gym session is confirmed.',
    'We look forward to seeing you at the gym.',
    '',
    'If you have any questions or need to make changes, reply to this email.',
    '',
    'Thanks!',
  ]

  return { subject, text: lines.join('\n') }
}

async function sendEmails(mailgun, domain, fromEmail, recipients, sessionName) {
  const { subject, text } = buildEmailContent(sessionName)

  const sendResults = await Promise.allSettled(
    recipients.map((email) =>
      mailgun.messages.create(domain, {
        from: fromEmail,
        to: email,
        subject,
        text,
      })
    )
  )

  const failed = sendResults.filter((result) => result.status === 'rejected')
  if (failed.length > 0) {
    const errors = failed.map((failure) => failure.reason?.message || failure.reason)
    throw new Error(`Failed to send confirmation email to some recipients: ${errors.join(', ')}`)
  }
}

async function markSessionAsEmailed(notion, sessionId) {
  await notion.pages.update({
    page_id: sessionId,
    properties: {
      [SESSION_EMAIL_SENT_PROPERTY]: {
        checkbox: true,
      },
    },
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const notion = getNotionClient()
    const mailgun = getMailgunClient()

    const sessionsDatabaseId = getEnv('NOTION_SESSIONS_DATABASE_ID')
    getEnv('NOTION_USERS_DATABASE_ID') // Ensure the expected users database is configured

    const mailgunDomain = getEnv('MAILGUN_DOMAIN')
    const fromEmail = process.env.MAILGUN_FROM_EMAIL || `no-reply@${mailgunDomain}`

    const sessions = await fetchConfirmedSessions(notion, sessionsDatabaseId)

    if (!sessions.length) {
      return res.status(200).json({
        success: true,
        message: 'No confirmed sessions pending email dispatch.',
        sessionsProcessed: 0,
      })
    }

    const processed = []

    for (const session of sessions) {
      const sessionId = session.id
      const sessionName = getSessionTitle(session)

      const relations = getSessionUserRelations(session)
      const recipients = await fetchUserEmails(notion, relations)

      if (!recipients.length) {
        processed.push({ sessionId, sessionName, emailsSent: 0, reason: 'No recipient emails found.' })
        continue
      }

      await sendEmails(mailgun, mailgunDomain, fromEmail, recipients, sessionName)
      await markSessionAsEmailed(notion, sessionId)

      processed.push({ sessionId, sessionName, emailsSent: recipients.length })
    }

    return res.status(200).json({
      success: true,
      message: 'Confirmation emails sent successfully.',
      sessionsProcessed: processed.length,
      details: processed,
    })
  } catch (error) {
    console.error('Failed to send session confirmation emails', error)

    const message = error instanceof Error ? error.message : 'Unexpected error'
    return res.status(500).json({ success: false, error: message })
  }
}
