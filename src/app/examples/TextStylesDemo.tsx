import React from 'react';
import { Text, Heading1, Heading2, Heading3, Paragraph, Caption } from '../components/ui/Text';
import { getTextStyle, getTextClasses } from '../utils/textStyles';

/**
 * Demo component showcasing the different ways to style text
 */
export default function TextStylesDemo() {
  return (
    <div className="p-6 bg-white">
      <section className="mb-8">
        <h2 className="mb-4 font-bold text-xl">1. Using Text Components</h2>

        <Heading1 className="mb-4">Component-based Heading 1</Heading1>

        <Heading2 font="playfair" weight="bold" color="primary" className="mb-4">
          Custom Heading 2 with Playfair font
        </Heading2>

        <Heading3 font="noto-serif" tracking="wide" className="mb-4">
          Heading 3 with Noto Serif
        </Heading3>

        <Paragraph className="mb-4">
          This is a standard paragraph with default styling.
        </Paragraph>

        <Paragraph font="roboto-mono" weight="light" color="secondary" className="mb-4">
          This paragraph uses Roboto Mono font with light weight and secondary color.
        </Paragraph>

        <Caption>This is a small caption text</Caption>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 font-bold text-xl">2. Using Utility Classes</h2>

        <h1 className="font-inter weight-bold text-4xl tracking-wider text-gray-900 mb-4">
          Heading with utility classes
        </h1>

        <p className="font-playfair weight-medium text-lg text-blue-600 mb-4">
          Paragraph with Playfair font and medium weight
        </p>

        <span className="font-roboto-mono weight-light text-sm text-gray-600 block mb-4">
          This is a small text with Roboto Mono
        </span>
      </section>

      <section>
        <h2 className="mb-4 font-bold text-xl">3. Using Inline Styles</h2>

        <h1 style={getTextStyle({
          font: 'inter',
          weight: 'bold',
          size: '4xl',
          color: '#111111',
          tracking: 'wider'
        })} className="mb-4">
          Heading with inline styles
        </h1>

        <p style={getTextStyle({
          font: 'noto-serif',
          weight: 'medium',
          size: 'lg',
          color: '#6B7280'
        })} className="mb-4">
          Paragraph with inline styles
        </p>

        <div className={getTextClasses({
          font: 'playfair',
          weight: 'light',
          size: 'base',
          color: 'gray-800',
          tracking: 'wide'
        })}>
          Text styled with utility function
        </div>
      </section>
    </div>
  );
}
