import "./CardSpace.css";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { Space } from "../../../types/space";
import SpaceModal from "../../SpacesPage/Body/SpaceModal/SpaceModal";
import SpaceModalContent from "../../SpacesPage/Body/SpaceModal/SpaceModalContent/SpaceModalContent";

interface CardSpaceProps {
  fakeArraySpace: Space;
}

function CardSpace({ fakeArraySpace }: CardSpaceProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <article className="card-space-container">
      <div className="card-space-img-container">
        <img
          className="card-space-img"
          src={`${import.meta.env.VITE_API_URL ?? ""}${fakeArraySpace.url_image}`}
          alt={fakeArraySpace.space_name}
        />
      </div>

      <span className="card-space-badge-price">
        {fakeArraySpace.price_unit === 0
          ? "Gratuit"
          : `${fakeArraySpace.price_unit} €`}
      </span>

      <div className="card-space-text-flex">
        <h3>{fakeArraySpace.space_name}</h3>
        <p>{fakeArraySpace.description}</p>
        <button
          className="card-space-btn-reserve"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          Réserver
        </button>
      </div>

      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <SpaceModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
            >
              <SpaceModalContent
                spaces={[fakeArraySpace]}
                categoryName={fakeArraySpace.space_category}
                onClose={() => setIsModalOpen(false)}
              />
            </SpaceModal>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </article>
  );
}

export default CardSpace;
