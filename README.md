<button
          contenteditable='false'
          type='button'
          class='heading-button'
          data-text={hashes}
          onclick={onHeadingClick}
          onmousedown={preventDefault /* Prevent editor focus on mobile */}
        >
          <div>
            {/* Wrapper makes deleteSoftLineBackward work on Chrome */}h
            <span class='heading-button-level'>{level}</span>
          </div>
        </button>