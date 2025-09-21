"use client";

import React, { useState, useRef, useEffect } from 'react'
import Select, { components, DropdownIndicatorProps, GroupBase } from 'react-select'
import { Member } from '@/types/members'

type OptionItem = { value: string; label: string; member: Member }

const DropdownIndicator = (
  props: DropdownIndicatorProps<OptionItem, false, GroupBase<OptionItem>>
) => (
  <components.DropdownIndicator {...props}>
    <svg style={{ display: 'block' }} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 8L10 12L14 8" stroke="#7D8DA6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </components.DropdownIndicator>
)

interface FiltersProps {
  members: Member[]
  selectedMember: Member | null
  onChange: (member: Member | null) => void
}

export default function Filters({ members, selectedMember, onChange }: FiltersProps) {
  const [isHover, setIsHover] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const el = wrapperRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
      setIsHover(prev => (prev === inside ? prev : inside))
    }

    window.addEventListener('pointermove', onPointerMove)
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])

  const options = members.map(m => ({ value: m.id, label: m.name, member: m }))

  return (
    <div ref={wrapperRef} style={{ width: 260 }}>
      <Select
        components={{ DropdownIndicator }}
        classNamePrefix="rs"
        instanceId="coxing-member-filter"
        isSearchable
        isClearable
        options={options}
        value={selectedMember ? options.find(o => o.value === selectedMember.id) : null}
        onChange={(opt) => onChange(opt ? opt.member : null)}
        styles={{
          control: (base) => ({
            ...base,
            display: 'flex',
            flexDirection: 'row',
            padding: '4px 0',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 0,
            background: isHover ? 'rgba(125,141,166,0.20)' : 'rgba(246,247,249,0.60)',
            borderRadius: '10px',
            position: 'relative',
            border: 'none',
            boxShadow: 'none',
            minHeight: '36px',
            fontSize: '14px',
            fontFamily: 'Gilroy',
            cursor: 'pointer',
          }),
          valueContainer: (base) => ({ ...base, padding: '0 16px' }),
          indicatorsContainer: (base) => ({ ...base, width: 44 }),
          menu: (base) => ({ ...base, zIndex: 9999, boxShadow: '0 4px 16px rgba(174,174,174,0.10)', borderRadius: 10 }),
          option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#238AFF' : state.isFocused ? '#E6F0FF' : 'transparent',
            color: state.isSelected ? '#fff' : '#4C5A6E',
            fontFamily: 'Gilroy',
            fontSize: '14px',
            padding: '8px 10px',
          }),
        }}
        menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
        placeholder="Select cox"
      />
    </div>
  )
}
