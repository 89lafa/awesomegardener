import React from 'react';
import PublicAccessGate from './PublicAccessGate';

/**
 * Higher Order Component to wrap pages with public access control
 * Usage: export default withPublicAccess(MyPage, 'MyPage');
 */
export default function withPublicAccess(Component, pageName) {
  return function WrappedComponent(props) {
    return (
      <PublicAccessGate pageName={pageName}>
        <Component {...props} />
      </PublicAccessGate>
    );
  };
}