import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

it('uses distinct accessible heading IDs for multiple empty states', () => {
  render(<><EmptyState title="第一个空状态" /><EmptyState title="第二个空状态" /></>);
  const sections = screen.getAllByRole('region');
  expect(sections[0]).not.toHaveAttribute('aria-labelledby', sections[1].getAttribute('aria-labelledby'));
  expect(sections[0]).toHaveAccessibleName('第一个空状态');
  expect(sections[1]).toHaveAccessibleName('第二个空状态');
});
