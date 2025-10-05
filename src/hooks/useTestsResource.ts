// src/hooks/useTestsResource.ts
"use client";

import { useCallback, useEffect, useState } from 'react'
import type { Test } from '@/types/test'

interface TestsState {
  tests: Test[]
  loading: boolean
  error: string | null
}

const CACHE_TTL_MS = 30_000

let cachedTests: Test[] | null = null
let cacheTimestamp = 0
let inflightPromise: Promise<Test[]> | null = null
const listeners = new Set<(tests: Test[]) => void>()

function notifyListeners(tests: Test[]) {
  listeners.forEach(listener => {
    try {
      listener(tests)
    } catch (err) {
      console.error('❌ useTestsResource listener error:', err)
    }
  })
}

function updateCache(tests: Test[]) {
  cachedTests = tests
  cacheTimestamp = Date.now()
  notifyListeners(tests)
}

async function fetchTests(): Promise<Test[]> {
  const response = await fetch('/api/get-tests', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to fetch tests: ${response.status}`)
  }

  const data = await response.json()
  return (data.tests ?? []) as Test[]
}

function shouldUseCache() {
  if (!cachedTests) return false
  return Date.now() - cacheTimestamp < CACHE_TTL_MS
}

async function loadTests(force = false) {
  if (!force && shouldUseCache()) {
    return cachedTests ?? []
  }

  if (inflightPromise) {
    return inflightPromise
  }

  inflightPromise = fetchTests()
    .then((tests) => {
      updateCache(tests)
      return tests
    })
    .finally(() => {
      inflightPromise = null
    })

  return inflightPromise
}

export function useTestsResource() {
  const [state, setState] = useState<TestsState>(() => ({
    tests: cachedTests ?? [],
    loading: !shouldUseCache(),
    error: null,
  }))

  useEffect(() => {
    let cancelled = false

    const listener = (tests: Test[]) => {
      if (cancelled) return
      setState({ tests, loading: false, error: null })
    }

    listeners.add(listener)

    if (shouldUseCache()) {
      listener(cachedTests ?? [])
    } else {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      loadTests().catch((error: Error) => {
        if (cancelled) return
        setState({ tests: [], loading: false, error: error.message })
      })
    }

    return () => {
      cancelled = true
      listeners.delete(listener)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      await loadTests(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh tests'
      setState({ tests: cachedTests ?? [], loading: false, error: message })
    }
  }, [])

  return {
    tests: state.tests,
    loading: state.loading,
    error: state.error,
    refresh,
  }
}

export function updateTestInCache(updatedTest: Test) {
  const tests = cachedTests ?? []
  const index = tests.findIndex((t) => t.id === updatedTest.id)
  let next: Test[]

  if (index !== -1) {
    next = [...tests]
    next[index] = updatedTest
  } else {
    next = [...tests, updatedTest]
  }

  updateCache(next)
}
